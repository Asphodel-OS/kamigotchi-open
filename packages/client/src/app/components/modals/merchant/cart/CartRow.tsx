import styled from 'styled-components';

import { calcListingBuyPrice } from 'app/cache/npc';
import { ItemTooltip, TextTooltip } from 'app/components/library';
import { Palette } from 'app/components/library/pastel';
import { Listing } from 'network/shapes/Listing';
import { playClick } from 'utils/sounds';
import { CurrencyTooltip } from '../CurrencyTooltip';
import { Main, Name, Price, Step, Tile } from '../styles';
import { ItemUtils } from '../types';
import { CART_MAX, CART_MIN, clampQuantity, formatAmount } from '../utils';

export const CartRow = ({
  listing,
  currencyBalance,
  quantity,
  setQuantity,
  remove,
  utils,
}: {
  listing: Listing;
  currencyBalance: number;
  quantity: number;
  setQuantity: (quantity: number) => void;
  remove: () => void;
  utils: ItemUtils;
}) => {
  const { item, payItem } = listing;
  const cost = calcListingBuyPrice(listing, quantity);

  const step = (delta: number) => {
    playClick();
    setQuantity(clampQuantity(quantity + delta));
  };

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '');
    setQuantity(clampQuantity(parseInt(digits || '0')));
  };

  return (
    <Row>
      <Remove onClick={remove}>x</Remove>
      <TextTooltip
        text={[<ItemTooltip key={item.index} item={item} utils={utils} />]}
        maxWidth={25}
      >
        <Tile $size={2.6}>
          <img src={item.image} alt={item.name} />
        </Tile>
      </TextTooltip>
      <Main>
        <Name>{item.name}</Name>
        <Controls>
          <Step disabled={quantity <= CART_MIN} onClick={() => step(-1)}>
            −
          </Step>
          <Quantity value={quantity} onChange={handleInput} inputMode='numeric' />
          <Step disabled={quantity >= CART_MAX} onClick={() => step(1)}>
            +
          </Step>
        </Controls>
      </Main>
      <CurrencyTooltip currency={payItem} cost={cost} balance={currencyBalance}>
        <Price $short={cost > currencyBalance}>
          <img src={payItem.image} alt={payItem.name} />
          {formatAmount(cost)}
        </Price>
      </CurrencyTooltip>
    </Row>
  );
};

const Row = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5vw;
  padding: 0.45vw 0.6vw;
  background: ${Palette.paper};
  border: solid ${Palette.ink} 0.12vw;
  border-radius: 0.6vw;
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.2vw;
`;

const Quantity = styled.input`
  width: 2.4vw;
  height: 1.4vw;
  padding: 0;
  text-align: center;
  font-family: Pixel;
  font-size: 0.65vw;
  font-variant-numeric: tabular-nums;
  color: ${Palette.ink};
  background: ${Palette.soft};
  border: solid ${Palette.line} 0.1vw;
  border-radius: 0.35vw;
  outline: none;

  &:focus {
    border-color: ${Palette.ink};
  }
`;

const Remove = styled.button`
  position: absolute;
  top: -0.45vw;
  right: -0.45vw;
  width: 1.1vw;
  height: 1.1vw;
  padding: 0;
  font-family: Pixel;
  font-size: 0.55vw;
  line-height: 1;
  color: ${Palette.ink};
  background: ${Palette.paper};
  border: solid ${Palette.ink} 0.1vw;
  border-radius: 99vw;
  cursor: pointer;

  &:hover {
    background: ${Palette.warn.bg};
  }
`;
