import styled from 'styled-components';

import { EmptyText } from 'app/components/library';
import { Item } from 'network/shapes/Item';
import { AuctionStatus } from '../../types';

export const PricePanel = ({
  data,
  state,
  isVisible,
}: {
  isVisible: boolean;
  data: {
    balance: number;
    payItem: Item;
    saleItem: Item;
    auctionStatus?: AuctionStatus; // unset for the legacy mint panels
  };
  state: {
    price: number;
    quantity: number;
    tick: number;
  };
}) => {
  const { auctionStatus, payItem, saleItem } = data;
  const { price, quantity, tick } = state;

  const getText = () => {
    if (auctionStatus === 'CLOSED') return [`The ${saleItem.name} auction is closed`];
    if (auctionStatus === 'SOLD_OUT') return [`${saleItem.name}s are sold out`];
    if (saleItem.index === 10 && tick / 1000 < 1747400400) {
      return [`Target ${price} ${payItem.name}`, `for 1 ${saleItem.name}`];
    }

    if (saleItem.index === 11 && tick / 1000 < 1760486400) {
      return [`Target ${price} ${payItem.name}s`, `for 1 ${saleItem.name}`];
    }

    return [
      `Total ${price.toLocaleString()} ${payItem.name}`,
      `for ${quantity} ${saleItem.name}${quantity == 1 ? '' : 's'}`,
    ];
  };

  return (
    <Container isVisible={isVisible}>
      <EmptyText text={getText()} />
    </Container>
  );
};

const Container = styled.div<{ isVisible: boolean }>`
  position: relative;
  height: 100%;
  width: 100%;
  padding: 0.6vw;

  display: ${({ isVisible }) => (isVisible ? 'flex' : 'none')};
  flex-direction: column;
  justify-content: flex-start;
`;
