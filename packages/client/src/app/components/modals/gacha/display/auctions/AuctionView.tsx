import styled from 'styled-components';

import { Overlay } from 'app/components/library';
import { Auction } from 'network/shapes/Auction';
import { formatCountdown } from 'utils/time';
import { getAuctionStatus } from '../../types';
import { Chart } from './Chart';

export const AuctionView = ({ auction, isVisible }: { auction: Auction; isVisible: boolean }) => {
  const getAuctionTitle = () => {
    if (!auction.auctionItem) return '??? Auction';
    const itemName = auction.auctionItem.name;
    return `${itemName} Auction`;
  };

  const getTimeLeft = () => {
    const now = Date.now() / 1000;
    const start = auction.time.start;
    return Math.max(start - now, 0);
  };

  const status = getAuctionStatus(auction);

  return (
    <Container isVisible={isVisible}>
      {status !== 'OPEN' && (
        <Overlay top={0} left={0} fullWidth fullHeight zIndex={1} passthrough>
          <Card>
            <Text size={2.4}>{status === 'CLOSED' ? 'Auction Closed' : 'Sold Out'}</Text>
            <Text size={1.2}>
              {status === 'CLOSED'
                ? 'no more tickets are being sold'
                : `all ${auction.supply.total.toLocaleString()} tickets have been sold`}
            </Text>
            <Text size={1.2}>tickets you already hold still work</Text>
          </Card>
        </Overlay>
      )}
      {status === 'OPEN' && auction.time.start > Date.now() / 1000 && (
        <Overlay orientation='column' opacity={0.5} fullWidth>
          <Text size={3}>Auction Start</Text>
          <Text size={3}>{formatCountdown(getTimeLeft())}</Text>
        </Overlay>
      )}
      {status !== 'CLOSED' && <Chart name={getAuctionTitle()} auction={auction} />}
    </Container>
  );
};

const Container = styled.div<{ isVisible: boolean }>`
  position: relative;
  width: 100%;
  min-height: 100%;

  display: ${({ isVisible }) => (isVisible ? 'flex' : 'none')};
  flex-flow: column wrap;
  align-items: flex-start;
  justify-content: space-around;
`;

const Text = styled.div<{ size: number }>`
  color: black;
  font-size: ${({ size }) => size}vw;
  line-height: ${({ size }) => size * 1.5}vw;
`;

const Card = styled.div`
  background-color: rgba(255, 255, 255, 0.92);
  border: 0.15vw solid black;
  border-radius: 1.2vw;
  padding: 1.8vw 2.4vw;

  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  gap: 0.6vw;
`;
