import styled from 'styled-components';

import { TextTooltip } from 'app/components/library';
import { Palette } from 'app/components/library/pastel';
import { CurrencyTooltip } from '../CurrencyTooltip';
import { Button, Price } from '../styles';
import { CurrencyTotal, formatAmount, isShort } from '../utils';

// the cart's cost per currency, and the buy button
export const Checkout = ({ totals, buy }: { totals: CurrencyTotal[]; buy: () => void }) => {
  const short = totals.filter(isShort);
  const tooltip = short.map(
    (t) =>
      `Not enough ${t.currency.name}: ${formatAmount(t.amount)} needed, ${formatAmount(t.balance)} held`
  );

  return (
    <Container>
      <Totals>
        <Label>Total</Label>
        {totals.map((t) => (
          <CurrencyTooltip
            key={t.currency.index}
            currency={t.currency}
            cost={t.amount}
            balance={t.balance}
          >
            <Price $short={isShort(t)}>
              <img src={t.currency.image} alt={t.currency.name} />
              {formatAmount(t.amount)}
            </Price>
          </CurrencyTooltip>
        ))}
      </Totals>
      <TextTooltip text={tooltip.length > 0 ? tooltip : ['']}>
        <Buy disabled={short.length > 0} onClick={buy}>
          Buy
        </Buy>
      </TextTooltip>
    </Container>
  );
};

const Container = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6vw;
  padding: 0.7vw 0.8vw;
  background: ${Palette.soft};
  border-top: solid ${Palette.line} 0.12vw;
`;

const Totals = styled.div`
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3vw;
`;

const Label = styled.span`
  margin-right: 0.2vw;
  font-family: Pixel;
  font-size: 0.55vw;
  text-transform: uppercase;
  color: ${Palette.muted};
`;

const Buy = styled(Button)`
  flex: none;
`;
