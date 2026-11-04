import { ReactNode } from 'react';
import styled from 'styled-components';

import { Tooltip } from 'app/components/library';
import { Palette } from 'app/components/library/pastel';
import { Item } from 'network/shapes/Item';
import { formatAmount } from './utils';

// a price's tooltip, in the crafting ingredients' style: icon tile, name, description,
// then what the player holds against what it costs
export const CurrencyTooltip = ({
  currency,
  cost,
  balance,
  children,
}: {
  currency: Item;
  cost: number;
  balance: number;
  children: ReactNode;
}) => (
  <Tooltip
    isDisabled={false}
    maxWidth={18}
    content={
      <Box>
        <Head>
          <Icon>
            <img src={currency.image} alt={currency.name} />
          </Icon>
          <Name>{currency.name}</Name>
        </Head>
        {currency.description && <Text>{currency.description}</Text>}
        <Counts $short={cost > balance}>
          You have {formatAmount(balance)} · Costs {formatAmount(cost)}
        </Counts>
      </Box>
    }
  >
    {children}
  </Tooltip>
);

const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5vw;
  min-width: 11vw;
  text-align: left;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6vw;
`;

const Icon = styled.div`
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

const Name = styled.span`
  font-family: Pixel;
  font-size: 0.72vw;
  line-height: 1.3;
  color: ${Palette.ink};
`;

const Text = styled.p`
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
