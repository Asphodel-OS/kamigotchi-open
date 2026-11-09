import styled from 'styled-components';

import placeholderItems from 'assets/images/items/placeholder_items_cycle.gif';

// placeholder tab for what the gacha does next
export const Mystery = ({ isVisible }: { isVisible: boolean }) => {
  return (
    <Container isVisible={isVisible}>
      <Image src={placeholderItems} />
      <Title>???</Title>
      <Subtitle>coming soon</Subtitle>
    </Container>
  );
};

const Container = styled.div<{ isVisible: boolean }>`
  width: 100%;
  height: 100%;
  min-height: 30vw;

  display: ${({ isVisible }) => (isVisible ? 'flex' : 'none')};
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;
  gap: 1.2vw;
`;

const Image = styled.img`
  width: 12vw;
  height: 12vw;
  border: 0.15vw solid black;
  border-radius: 1.2vw;
  image-rendering: pixelated;
`;

const Title = styled.div`
  color: black;
  font-size: 3vw;
  line-height: 4vw;
`;

const Subtitle = styled.div`
  color: #333;
  font-size: 1.5vw;
  line-height: 2.2vw;
`;
