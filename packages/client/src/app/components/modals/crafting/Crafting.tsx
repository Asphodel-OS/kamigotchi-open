import pluralize from 'pluralize';
import { useEffect, useState } from 'react';
import styled from 'styled-components';

import { calcCurrentStamina, getAccount } from 'app/cache/account';
import { getItemByIndex as _getItemByIndex } from 'app/cache/item';
import { getAllRecipes } from 'app/cache/recipes';
import { ModalHeader, ModalWrapper } from 'app/components/library';
import { Palette } from 'app/components/library/pastel';
import { useLayers } from 'app/root/hooks';
import { UIComponent } from 'app/root/types';
import { useVisibility } from 'app/stores';
import { CraftIcon } from 'assets/images/icons/actions';
import { Account, queryAccountFromEmbedded } from 'network/shapes/Account';
import { parseAllos as _parseAllos, Allo } from 'network/shapes/Allo';
import { parseConditionalText, passesConditions } from 'network/shapes/Conditional';
import { getItemBalance as _getItemBalance, Item } from 'network/shapes/Item';
import { Kami } from 'network/shapes/Kami';
import { hasIngredients as _hasIngredients, Ingredient, Recipe } from 'network/shapes/Recipe';
import { playClick, playCrafting } from 'utils/sounds';
import { Recipes } from './Recipes/Recipes';

// recipe type -> tab label and its pastel when selected
const TABS = [
  { key: 'consumable', label: 'Consumables', color: '#c9ecd3' },
  { key: 'reagent', label: 'Extracts', color: '#fbeebb' },
  { key: 'material', label: 'Building', color: '#e1efff' },
  { key: 'special', label: 'Key Items', color: '#f3dde2' },
];

export const CraftingModal: UIComponent = {
  id: 'CraftingModal',
  Render: () => {
    const layers = useLayers();

    const {
      network: { actions, api, components, world },
      data: { account },
      utils: {
        meetsRequirementsRecipe,
        meetsRequirements,
        displayRecipeRequirements,
        displayItemRequirements,
        getItemBalance,
        hasIngredients,
        parseAllos,
        getItemByIndex,
      },
    } = (() => {
      const { network } = layers;
      const { world, components } = network;

      const accountEntity = queryAccountFromEmbedded(network);
      const account = getAccount(world, components, accountEntity, { live: 2, config: 3600 });

      return {
        network,
        data: { account },
        utils: {
          meetsRequirementsRecipe: (recipe: Recipe) =>
            passesConditions(world, components, recipe.requirements, account),
          meetsRequirements: (holder: Kami | Account, item: Item) =>
            passesConditions(world, components, item.requirements.use, holder),
          // TODO: horrendous pattern. refactor when/how we parse conditional text
          displayRecipeRequirements: (recipe: Recipe) => {
            return recipe.requirements
              .map((req) => parseConditionalText(world, components, req))
              .join(', ');
          },
          displayItemRequirements: (item: Item) => {
            return item.requirements.use
              .map((req) => parseConditionalText(world, components, req))
              .join('\n ');
          },
          getItemBalance: (index: number) => _getItemBalance(world, components, account.id, index),
          hasIngredients: (recipe: Recipe) =>
            _hasIngredients(world, components, recipe, account.id),
          parseAllos: (allo: Allo[]) => _parseAllos(world, components, allo),
          getItemByIndex: (index: number) => _getItemByIndex(world, components, index),
        },
      };
    })();

    const craftingModalVisible = useVisibility((s) => s.modals.crafting);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [craftableOnly, setCraftableOnly] = useState(false);
    const [tab, setTab] = useState('consumable'); //  consumable | material | reagent | special
    const [stamina, setStamina] = useState(0);
    const [tick, setTick] = useState(Date.now());

    /////////////////
    // stamina regenerates over time, so tick while open
    useEffect(() => {
      if (!craftingModalVisible) return;
      const timerID = setInterval(() => setTick(Date.now()), 5000);
      return () => clearInterval(timerID);
    }, [craftingModalVisible]);

    useEffect(() => {
      setStamina(calcCurrentStamina(account));
    }, [account.stamina.sync, tick]);

    // update the list of recipes depending on the filter
    useEffect(() => {
      const recipes = getAllRecipes(world, components);
      const currentTabRecipes = recipes.filter((recipe) => recipe.type === tab.toUpperCase());
      if (!craftableOnly) setRecipes(currentTabRecipes);
      else
        setRecipes(
          currentTabRecipes.filter(
            (recipe) =>
              meetsRequirementsRecipe(recipe) &&
              hasIngredients(recipe) &&
              stamina >= recipe.cost.stamina
          )
        );
    }, [craftableOnly, tab, craftingModalVisible, stamina, tick]);

    /////////////////
    // INTERPRETATION

    const getIngredientsText = (ingredients: Ingredient[], multiplier: number) => {
      let text = '';
      ingredients.forEach((ingredient) => {
        const amount = ingredient.amount * multiplier;
        const name = ingredient.item?.name ?? 'Unknown';
        text += pluralize(name, amount, true) + ' ';
      });
      return text;
    };

    /////////////////
    // ACTIONS

    const craft = (recipe: Recipe, amount: number) => {
      actions.add({
        action: 'Craft',
        params: [recipe.id, amount],
        description: `Crafting ${getIngredientsText(recipe.outputs, amount)}`,
        execute: async () => {
          return api.player.account.item.craft(recipe.index, amount);
        },
      });
      playCrafting();
    };

    const toggleCraftable = () => {
      playClick();
      setCraftableOnly(!craftableOnly);
    };

    /////////////////
    // DISPLAY

    const selectTab = (key: string) => {
      if (key === tab) return;
      playClick();
      setTab(key);
    };

    const TabRow = (
      <Tabs key='tabs'>
        {TABS.map(({ key, label, color }) => (
          <TabButton
            key={key}
            $color={color}
            $active={tab === key}
            disabled={tab === key}
            onClick={() => selectTab(key)}
          >
            {label}
          </TabButton>
        ))}
      </Tabs>
    );

    return (
      <ModalWrapper
        id='crafting'
        header={[<ModalHeader key='header' title='Crafting' icon={CraftIcon} />, TabRow]}
        canExit
        noPadding
      >
        <Content>
          <Toolbar>
            <Count>
              {pluralize('item', new Set(recipes.map((r) => r.outputs[0]?.index)).size, true)}
            </Count>
            <Toggle $active={craftableOnly} aria-pressed={craftableOnly} onClick={toggleCraftable}>
              <Box $active={craftableOnly}>{craftableOnly ? '✓' : ''}</Box>
              Craftable only
            </Toggle>
          </Toolbar>
          {recipes.length == 0 ? (
            <Empty>
              {craftableOnly
                ? 'Nothing here you can craft right now.'
                : 'There are no recipes here.'}
            </Empty>
          ) : (
            <Recipes
              data={{ account, recipes, stamina }}
              actions={{ craft }}
              utils={{
                hasIngredients,
                meetsRequirementsRecipe,
                meetsRequirements,
                displayRecipeRequirements,
                displayItemRequirements,
                getItemBalance,
                parseAllos,
                getItemByIndex,
              }}
            />
          )}
        </Content>
      </ModalWrapper>
    );
  },
};

const Tabs = styled.div`
  width: 100%;
  display: flex;
  flex-flow: row nowrap;
  background-color: white;
  border-top: solid black 0.15vw;
`;

const TabButton = styled.button<{ $color: string; $active: boolean }>`
  flex: 1 1 0;
  padding: 0.5vw;
  font-family: Pixel;
  font-size: 0.75vw;
  color: black;
  text-align: center;
  background-color: ${({ $active, $color }) => ($active ? $color : 'white')};
  border: none;
  border-right: solid black 0.15vw;
  cursor: pointer;

  &:last-child {
    border-right: none;
  }
  &:hover {
    background-color: ${({ $color }) => $color}88;
  }
  &:disabled {
    cursor: default;
    pointer-events: none;
  }
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6vw;
  padding: 0.7vw 0.8vw;
  user-select: none;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6vw;
`;

const Count = styled.span`
  font-family: Pixel;
  font-size: 0.6vw;
  color: ${Palette.muted};
`;

const Toggle = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.4vw;
  padding: 0.3vw 0.6vw;
  font-family: Pixel;
  font-size: 0.6vw;
  color: ${Palette.ink};
  background: ${({ $active }) => ($active ? Palette.button.bg : Palette.paper)};
  border: solid ${({ $active }) => ($active ? Palette.ink : Palette.line)} 0.12vw;
  border-radius: 0.45vw;
  cursor: pointer;

  &:hover {
    background: ${({ $active }) => ($active ? Palette.button.hover : Palette.soft)};
  }
`;

const Box = styled.span<{ $active: boolean }>`
  width: 0.85vw;
  height: 0.85vw;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5vw;
  color: ${Palette.progress.edge};
  background: ${Palette.paper};
  border: solid ${({ $active }) => ($active ? Palette.progress.edge : Palette.faint)} 0.1vw;
  border-radius: 0.2vw;
`;

const Empty = styled.div`
  padding: 2vw 1vw;
  text-align: center;
  font-family: Pixel;
  font-size: 0.7vw;
  line-height: 1.6;
  color: ${Palette.muted};
  background: ${Palette.soft};
  border: dashed ${Palette.line} 0.12vw;
  border-radius: 0.7vw;
`;
