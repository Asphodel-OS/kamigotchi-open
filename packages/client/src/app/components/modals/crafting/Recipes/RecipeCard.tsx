import { ReactNode, useState } from 'react';
import styled from 'styled-components';

import { ItemTooltip, TextTooltip, Tooltip } from 'app/components/library';
import { Palette } from 'app/components/library/pastel';
import { StaminaIcon } from 'assets/images/icons/stats';
import { Kami } from 'network/shapes';
import { Account } from 'network/shapes/Account';
import { Allo } from 'network/shapes/Allo';
import { Item, NullItem } from 'network/shapes/Item';
import { Recipe } from 'network/shapes/Recipe';
import { DetailedEntity } from 'network/shapes/utils';
import { playClick, playMessage } from 'utils/sounds';

const XP = { bg: '#fbeebb', edge: '#c9a227' };
const STAMINA = { bg: '#e4f2ff', edge: '#36a6ff' };

export const RecipeCard = ({
  data,
  actions,
  utils,
}: {
  data: {
    account: Account;
    recipes: Recipe[]; // every recipe for the same output item
    stamina: number;
  };
  actions: {
    craft: (recipe: Recipe, amount: number) => void;
  };
  utils: {
    canCraft: (recipe: Recipe) => boolean;
    displayRecipeRequirements: (recipe: Recipe) => string;
    displayItemRequirements: (item: Item) => string;
    getItemBalance: (index: number) => number;
    meetsRequirementsRecipe: (recipe: Recipe) => boolean;
    meetsRequirements: (holder: Kami | Account, item: Item) => boolean;
    parseAllos: (allo: Allo[]) => DetailedEntity[];
    getItemByIndex: (itemIndex: number) => Item;
  };
}) => {
  const { recipes, stamina } = data;
  const { getItemBalance, getItemByIndex, meetsRequirementsRecipe, displayRecipeRequirements } =
    utils;
  const [variant, setVariant] = useState(() => Math.max(0, recipes.findIndex(utils.canCraft)));
  const [quantity, setQuantity] = useState(1);

  const recipe = recipes[Math.min(variant, recipes.length - 1)];
  const output = recipe.outputs[0];
  const item = output.item ?? NullItem;
  const staminaCost = recipe.cost.stamina * quantity;

  /////////////////
  // INTERPRETATION

  const ingredients = recipe.inputs.map((input) => ({
    item: input.item ?? NullItem,
    need: input.amount * quantity,
    have: getItemBalance(input.index),
  }));

  // recipes need at most one tool (an item requirement); it gets its own slot
  const toolReq = recipe.requirements.find((req) => req.target.type === 'ITEM');
  const tool = toolReq ? getItemByIndex(toolReq.target.index ?? 0) : undefined;
  const hasTool =
    !toolReq || getItemBalance(toolReq.target.index ?? 0) >= (toolReq.target.value ?? 1);

  // the first thing stopping this craft, shown on the button's tooltip
  const getBlocker = (): string => {
    if (!hasTool && tool) return `Needs a ${tool.name}`;
    if (!meetsRequirementsRecipe(recipe)) return `Needs ${displayRecipeRequirements(recipe)}`;
    const short = ingredients.find((i) => i.have < i.need);
    if (short) return `Not enough ${short.item.name}`;
    if (stamina < staminaCost) return 'Not enough stamina';
    return '';
  };

  /////////////////
  // ACTIONS

  const step = (value: number) => {
    playClick();
    setQuantity(Math.max(1, value));
  };

  const pickVariant = (i: number) => {
    if (i === variant) return;
    playClick();
    setVariant(i);
  };

  const handleCraft = () => {
    playMessage();
    actions.craft(recipe, quantity);
  };

  /////////////////
  // RENDER

  const blocker = getBlocker();
  const toolState = !tool ? 'none' : hasTool ? 'owned' : 'missing';

  return (
    <Card>
      <TextTooltip
        text={[
          <ItemTooltip
            key={item.index}
            item={item}
            utils={{
              parseAllos: utils.parseAllos,
              displayRequirements: utils.displayItemRequirements,
            }}
          />,
        ]}
        maxWidth={25}
      >
        <Output>
          <img src={item.image} alt={item.name} />
        </Output>
      </TextTooltip>

      <Main>
        <Row>
          <Name>{item.name}</Name>
          <Yield>x{output.amount * quantity}</Yield>
          <Spacer />
          {recipe.cost.stamina > 0 && (
            <Pill $color={STAMINA} $short={stamina < staminaCost}>
              <img src={StaminaIcon} alt='Stamina' />
              {staminaCost}
            </Pill>
          )}
          {recipe.experience > 0 && <Pill $color={XP}>+{recipe.experience * quantity} XP</Pill>}
        </Row>
        <Row>
          {recipes.length > 1 && (
            <Variants>
              <From>from</From>
              {recipes.map((r, i) => {
                const main = r.inputs[0]?.item ?? NullItem;
                return (
                  <TextTooltip key={r.index} text={[`Make it from ${main.name}`]}>
                    <VariantButton $active={i === variant} onClick={() => pickVariant(i)}>
                      <img src={main.image} alt={main.name} />
                    </VariantButton>
                  </TextTooltip>
                );
              })}
            </Variants>
          )}
          <Ingredients>
            {ingredients.map(({ item: input, need, have }) => (
              <Tooltip
                key={input.index}
                content={
                  <Tip
                    image={input.image}
                    name={input.name}
                    description={input.description}
                    footer={
                      <Counts $short={have < need}>
                        You have {have.toLocaleString('en-US')} · Needs{' '}
                        {need.toLocaleString('en-US')}
                      </Counts>
                    }
                  />
                }
                maxWidth={18}
                isDisabled={false}
              >
                <Chip $short={have < need}>
                  <img src={input.image} alt={input.name} />
                  {need}
                </Chip>
              </Tooltip>
            ))}
          </Ingredients>
          <Spacer />
          <Controls>
            <Step disabled={quantity <= 1} onClick={() => step(quantity - 1)}>
              −
            </Step>
            <Qty>{quantity}</Qty>
            <Step onClick={() => step(quantity + 1)}>+</Step>
            <TextTooltip text={[blocker || `Craft ${quantity}`]}>
              <CraftButton disabled={!!blocker} onClick={handleCraft}>
                Craft
              </CraftButton>
            </TextTooltip>
          </Controls>
        </Row>
      </Main>

      <Tooltip
        content={
          tool ? (
            <Tip
              image={tool.image}
              name={tool.name}
              description='A tool. Crafting needs it in your inventory but does not use it up.'
              footer={
                <Counts $short={!hasTool}>{hasTool ? 'You have one' : "You don't have one"}</Counts>
              }
            />
          ) : (
            <Tip name='No tool needed' description='This one is made by hand.' />
          )
        }
        maxWidth={18}
        isDisabled={false}
      >
        <ToolSlot $state={toolState}>
          <ToolLabel $state={toolState}>{tool ? 'Needs' : 'By hand'}</ToolLabel>
          {tool && <img src={tool.image} alt={tool.name} />}
        </ToolSlot>
      </Tooltip>
    </Card>
  );
};

// tooltip in the quest modal's style: icon tile, name, description, then a status line
const Tip = ({
  image,
  name,
  description,
  footer,
}: {
  image?: string;
  name: string;
  description?: string;
  footer?: ReactNode;
}) => (
  <TipBox>
    <TipHead>
      {image && (
        <TipIcon>
          <img src={image} alt={name} />
        </TipIcon>
      )}
      <TipName>{name}</TipName>
    </TipHead>
    {description && <TipText>{description}</TipText>}
    {footer}
  </TipBox>
);

const Card = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6vw;
  padding: 0.5vw 0.6vw;
  background: ${Palette.paper};
  border: solid ${Palette.ink} 0.12vw;
  border-radius: 0.6vw;

  img {
    image-rendering: pixelated;
  }
`;

const Output = styled.div`
  flex: none;
  width: 3vw;
  height: 3vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${Palette.soft};
  border: solid ${Palette.line} 0.1vw;
  border-radius: 0.45vw;

  img {
    width: 2.3vw;
    height: 2.3vw;
  }
`;

const Main = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35vw;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35vw;
  min-width: 0;
`;

const Spacer = styled.div`
  flex: 1;
`;

const Name = styled.span`
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: Pixel;
  font-size: 0.72vw;
  color: ${Palette.ink};
`;

const Yield = styled.span`
  flex: none;
  font-family: Pixel;
  font-size: 0.55vw;
  color: ${Palette.muted};
`;

const Pill = styled.span<{ $color: { bg: string; edge: string }; $short?: boolean }>`
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.2vw;
  height: 1.1vw;
  padding: 0 0.35vw;
  font-family: Pixel;
  font-size: 0.5vw;
  color: ${({ $short }) => ($short ? Palette.warn.edge : Palette.ink)};
  background: ${({ $color, $short }) => ($short ? Palette.warn.bg : $color.bg)};
  border: solid ${({ $color, $short }) => ($short ? Palette.warn.edge : $color.edge)} 0.1vw;
  border-radius: 99vw;

  img {
    width: 0.75vw;
    height: 0.75vw;
  }
`;

const Variants = styled.div`
  flex: none;
  display: flex;
  gap: 0.15vw;
  padding: 0.12vw;
  background: ${Palette.soft};
  border: solid ${Palette.line} 0.1vw;
  border-radius: 0.4vw;
`;

const From = styled.span`
  align-self: center;
  padding: 0 0.15vw 0 0.2vw;
  font-family: Pixel;
  font-size: 0.42vw;
  text-transform: uppercase;
  color: ${Palette.faint};
`;

const VariantButton = styled.button<{ $active: boolean }>`
  width: 1.4vw;
  height: 1.4vw;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: ${({ $active }) => ($active ? Palette.button.bg : 'transparent')};
  border: solid ${({ $active }) => ($active ? Palette.ink : 'transparent')} 0.1vw;
  border-radius: 0.3vw;
  cursor: pointer;

  img {
    width: 1.05vw;
    height: 1.05vw;
  }
`;

const Ingredients = styled.div`
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3vw;
`;

const Chip = styled.span<{ $short: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.2vw;
  height: 1.5vw;
  padding: 0 0.35vw 0 0.15vw;
  font-family: Pixel;
  font-size: 0.55vw;
  color: ${({ $short }) => ($short ? Palette.warn.edge : Palette.ink)};
  background: ${Palette.soft};
  border: solid ${({ $short }) => ($short ? Palette.warn.edge : Palette.line)} 0.1vw;
  border-radius: 0.35vw;
  font-variant-numeric: tabular-nums;

  img {
    width: 1.15vw;
    height: 1.15vw;
  }
`;

const Controls = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.2vw;
`;

const Step = styled.button`
  width: 1.5vw;
  height: 1.5vw;
  padding: 0;
  font-family: Pixel;
  font-size: 0.65vw;
  color: ${Palette.ink};
  background: ${Palette.paper};
  border: solid ${Palette.ink} 0.1vw;
  border-radius: 0.35vw;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${Palette.button.bg};
  }
  &:disabled {
    cursor: default;
    color: ${Palette.faint};
    border-color: ${Palette.line};
  }
`;

const Qty = styled.span`
  min-width: 1.4vw;
  text-align: center;
  font-family: Pixel;
  font-size: 0.62vw;
  color: ${Palette.ink};
  font-variant-numeric: tabular-nums;
`;

const CraftButton = styled.button`
  height: 1.5vw;
  margin-left: 0.25vw;
  padding: 0 0.7vw;
  font-family: Pixel;
  font-size: 0.6vw;
  color: ${Palette.ink};
  background: ${Palette.button.bg};
  border: solid ${Palette.ink} 0.12vw;
  border-radius: 0.4vw;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${Palette.button.hover};
  }
  &:active:not(:disabled) {
    transform: translateY(0.06vw);
  }
  &:disabled {
    cursor: default;
    color: ${Palette.faint};
    background: ${Palette.button.disabled};
    border-color: ${Palette.faint};
  }
`;

type ToolState = 'owned' | 'missing' | 'none';
const toolColors: Record<ToolState, { bg: string; edge: string; text: string }> = {
  owned: { bg: Palette.progress.fill, edge: Palette.progress.edge, text: Palette.progress.edge },
  missing: { bg: Palette.warn.bg, edge: Palette.warn.edge, text: Palette.warn.edge },
  none: { bg: 'transparent', edge: Palette.line, text: Palette.faint },
};

const ToolSlot = styled.div<{ $state: ToolState }>`
  flex: none;
  width: 3vw;
  height: 3vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15vw;
  background: ${({ $state }) => toolColors[$state].bg};
  border: ${({ $state }) => ($state === 'none' ? 'dashed' : 'solid')}
    ${({ $state }) => toolColors[$state].edge} 0.12vw;
  border-radius: 0.45vw;

  img {
    width: 1.6vw;
    height: 1.6vw;
    opacity: ${({ $state }) => ($state === 'missing' ? 0.5 : 1)};
  }
`;

const ToolLabel = styled.span<{ $state: ToolState }>`
  font-family: Pixel;
  font-size: 0.38vw;
  text-transform: uppercase;
  text-align: center;
  line-height: 1.2;
  color: ${({ $state }) => toolColors[$state].text};
`;

const TipBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5vw;
  min-width: 11vw;
  text-align: left;
`;

const TipHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6vw;
`;

const TipIcon = styled.div`
  flex: none;
  width: 2.4vw;
  height: 2.4vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${Palette.soft};
  border: solid ${Palette.line} 0.1vw;
  border-radius: 0.45vw;

  img {
    width: 1.8vw;
    height: 1.8vw;
    image-rendering: pixelated;
  }
`;

const TipName = styled.span`
  font-family: Pixel;
  font-size: 0.72vw;
  line-height: 1.3;
  color: ${Palette.ink};
`;

const TipText = styled.p`
  margin: 0;
  padding-top: 0.5vw;
  border-top: solid ${Palette.line} 0.08vw;
  font-family: Pixel;
  font-size: 0.58vw;
  line-height: 1.6;
  color: ${Palette.muted};
`;

const Counts = styled.span<{ $short: boolean }>`
  font-family: Pixel;
  font-size: 0.6vw;
  color: ${({ $short }) => ($short ? Palette.warn.edge : Palette.progress.edge)};
`;
