import styled from 'styled-components';

import { Item, Kami } from 'network/shapes';
import { Account } from 'network/shapes/Account';
import { Allo } from 'network/shapes/Allo';
import { Recipe } from 'network/shapes/Recipe';
import { DetailedEntity } from 'network/shapes/utils';
import { RecipeCard } from './RecipeCard';

export const Recipes = ({
  data,
  actions,
  utils,
}: {
  data: {
    account: Account;
    recipes: Recipe[];
    stamina: number;
  };
  actions: {
    craft: (recipe: Recipe, amount: number) => void;
  };
  utils: {
    displayRecipeRequirements: (recipe: Recipe) => string;
    displayItemRequirements: (item: Item) => string;
    getItemBalance: (index: number) => number;
    hasIngredients: (recipe: Recipe) => boolean;
    meetsRequirementsRecipe: (recipe: Recipe) => boolean;
    meetsRequirements: (holder: Kami | Account, item: Item) => boolean;
    parseAllos: (allo: Allo[]) => DetailedEntity[];
    getItemByIndex: (itemIndex: number) => Item;
  };
}) => {
  const { account, recipes, stamina } = data;
  const { hasIngredients, meetsRequirementsRecipe } = utils;

  // whether one batch of this recipe can be crafted right now
  const canCraft = (recipe: Recipe) =>
    meetsRequirementsRecipe(recipe) && stamina >= recipe.cost.stamina && hasIngredients(recipe);

  // one card per output item; its recipes become variants the player picks between
  const groups = new Map<number, Recipe[]>();
  for (const recipe of recipes) {
    const key = recipe.outputs[0]?.index ?? recipe.index;
    groups.set(key, [...(groups.get(key) ?? []), recipe]);
  }
  const name = (group: Recipe[]) => group[0].outputs[0]?.item?.name ?? '';
  const sorted = [...groups.values()].sort((a, b) => {
    const craftable = Number(b.some(canCraft)) - Number(a.some(canCraft));
    return craftable || name(a).localeCompare(name(b));
  });

  return (
    <List>
      {sorted.map((group) => (
        <RecipeCard
          key={group[0].index}
          data={{ account, recipes: group, stamina }}
          actions={actions}
          utils={{ ...utils, canCraft }}
        />
      ))}
    </List>
  );
};

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45vw;
`;
