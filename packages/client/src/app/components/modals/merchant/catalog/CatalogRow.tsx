import styled from 'styled-components';

import { calcListingBuyPrice } from 'app/cache/npc';
import { ItemTooltip, TextTooltip } from 'app/components/library';
import { getTierColors, Palette } from 'app/components/library/pastel';
import { PricingIcons } from 'assets/images/icons/pricing';
import { Listing } from 'network/shapes/Listing';
import { playClick } from 'utils/sounds';
import { CurrencyTooltip } from '../CurrencyTooltip';
import { Main, Name, Price, Tile } from '../styles';
import { ItemUtils } from '../types';
import { formatAmount } from '../utils';

const Gold = getTierColors('gold');

export const CatalogRow = ({
  listing,
  owned,
  currencyBalance,
  inCart,
  toggle,
  utils,
}: {
  listing: Listing;
  owned: number;
  currencyBalance: number;
  inCart: boolean;
  toggle: () => void;
  utils: ItemUtils;
}) => {
  const { item, payItem } = listing;
  const price = calcListingBuyPrice(listing, 1);
  const dynamic = listing.buy?.type === 'GDA';

  const getPricingTooltip = () => {
    const pricing = listing.buy;
    if (pricing?.type === 'GDA') return ['Dynamic price', 'It moves over time.'];
    if (pricing?.type === 'FIXED') return ['Fixed price', 'It never changes.'];
    return ['The pricing of this listing is unknown'];
  };

  const handleClick = () => {
    playClick();
    toggle();
  };

  return (
    <Row $inCart={inCart} onClick={handleClick}>
      <TextTooltip
        text={[<ItemTooltip key={item.index} item={item} utils={utils} />]}
        maxWidth={25}
      >
        <Tile $size={3.4}>
          <img src={item.image} alt={item.name} />
        </Tile>
      </TextTooltip>
      <Main>
        <Name>{item.name}</Name>
        <Line>
          <CurrencyTooltip currency={payItem} cost={price} balance={currencyBalance}>
            <Price $short={price > currencyBalance}>
              <img src={payItem.image} alt={payItem.name} />
              {formatAmount(price)}
            </Price>
          </CurrencyTooltip>
          <TextTooltip text={getPricingTooltip()}>
            <Pricing>
              <img
                src={dynamic ? PricingIcons.gda : PricingIcons.fixed}
                alt={dynamic ? 'dynamic' : 'fixed'}
              />
              {dynamic ? 'Dynamic' : 'Fixed'}
            </Pricing>
          </TextTooltip>
        </Line>
      </Main>
      <Side>
        <Owned>Owned {formatAmount(owned)}</Owned>
        <Toggle $inCart={inCart}>{inCart ? 'In cart' : 'Add'}</Toggle>
      </Side>
    </Row>
  );
};

const Row = styled.div<{ $inCart: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.7vw;
  padding: 0.5vw 0.7vw;
  background: ${({ $inCart }) => ($inCart ? Gold.bg : Palette.paper)};
  border: solid ${({ $inCart }) => ($inCart ? Gold.edge : Palette.ink)} 0.12vw;
  border-radius: 0.6vw;
  cursor: pointer;
  user-select: none;
  transition: background 0.1s ease;

  &:hover {
    background: ${({ $inCart }) => ($inCart ? Gold.bg : Palette.soft)};
  }
`;

const Line = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35vw;
`;

const Pricing = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25vw;
  height: 1.4vw;
  padding: 0 0.4vw 0 0.25vw;
  font-family: Pixel;
  font-size: 0.55vw;
  color: ${Palette.muted};
  background: ${Palette.soft};
  border: solid ${Palette.line} 0.1vw;
  border-radius: 99vw;

  img {
    width: 0.9vw;
    height: 0.9vw;
  }
`;

const Side = styled.div`
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4vw;
`;

const Owned = styled.span`
  font-family: Pixel;
  font-size: 0.55vw;
  color: ${Palette.muted};
  font-variant-numeric: tabular-nums;
`;

const Toggle = styled.span<{ $inCart: boolean }>`
  min-width: 3.4vw;
  padding: 0.3vw 0.5vw;
  text-align: center;
  font-family: Pixel;
  font-size: 0.6vw;
  color: ${Palette.ink};
  background: ${({ $inCart }) => ($inCart ? Palette.paper : Palette.button.bg)};
  border: solid ${({ $inCart }) => ($inCart ? Gold.edge : Palette.ink)} 0.1vw;
  border-radius: 0.4vw;
`;
