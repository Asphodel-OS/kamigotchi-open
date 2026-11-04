import styled from 'styled-components';

import { TextTooltip } from 'app/components/library';
import { Palette } from 'app/components/library/pastel';
import { Item } from 'network/shapes/Item';
import { formatAmount } from '../utils';

// what the player holds of each currency this merchant takes
export const Balance = ({
  currencies,
  getBalance,
}: {
  currencies: Item[];
  getBalance: (itemIndex: number) => number;
}) => {
  if (currencies.length === 0) return null;

  return (
    <Container>
      <Label>Balance</Label>
      <Rows>
        {currencies.map((currency) => (
          <TextTooltip key={currency.index} text={[currency.name]}>
            <Row>
              <img src={currency.image} alt={currency.name} />
              {formatAmount(getBalance(currency.index))}
            </Row>
          </TextTooltip>
        ))}
      </Rows>
    </Container>
  );
};

const Container = styled.div`
  flex: none;
  min-width: 9vw;
  margin-bottom: 0.9vw;
  overflow: hidden;
  background: ${Palette.paper};
  border: solid ${Palette.ink} 0.15vw;
  border-radius: 0.6vw;
`;

const Label = styled.div`
  padding: 0.45vw 0.8vw;
  background: ${Palette.soft};
  border-bottom: solid ${Palette.line} 0.12vw;
  font-family: Pixel;
  font-size: 0.55vw;
  text-transform: uppercase;
  color: ${Palette.muted};
`;

const Rows = styled.div`
  display: flex;
  gap: 1vw;
  padding: 0.6vw 0.8vw;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5vw;
  font-family: Pixel;
  font-size: 0.85vw;
  font-variant-numeric: tabular-nums;
  color: ${Palette.ink};

  img {
    width: 1.4vw;
    height: 1.4vw;
    image-rendering: pixelated;
  }
`;
