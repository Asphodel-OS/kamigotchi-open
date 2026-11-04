import styled from 'styled-components';

import { Palette } from 'app/components/library/pastel';
import { Item } from 'network/shapes/Item';
import { NPC } from 'network/shapes/Npc';
import { getMerchantLook } from '../config';
import { Balance } from './Balance';

export const Header = ({
  merchant,
  currencies,
  getBalance,
}: {
  merchant: NPC;
  currencies: Item[];
  getBalance: (itemIndex: number) => number;
}) => {
  const { image, height, title, tagline } = getMerchantLook(merchant);

  return (
    <Container>
      {image && <Portrait src={image} alt={merchant.name} $height={height} />}
      <Text>
        <Title>{title}</Title>
        {tagline && <Tagline>{tagline}</Tagline>}
      </Text>
      <Balance currencies={currencies} getBalance={getBalance} />
    </Container>
  );
};

// tall enough that the balance, kept at the bottom, never reaches the close button
const Container = styled.div`
  min-height: 8vw;
  margin: 0 1.2vw;
  display: flex;
  align-items: flex-end;
  gap: 1.2vw;
  user-select: none;
`;

const Portrait = styled.img<{ $height: number }>`
  flex: none;
  height: ${({ $height }) => $height}vw;
  max-width: 9vw;
  margin-bottom: -0.15vw;
  object-fit: contain;
  object-position: bottom;
  image-rendering: pixelated;
  user-drag: none;
`;

const Text = styled.div`
  flex: 1;
  min-width: 0;
  align-self: center;
  display: flex;
  flex-direction: column;
  gap: 0.6vw;
`;

const Title = styled.div`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: Pixel;
  font-size: 2.2vw;
  line-height: 1.2;
  color: ${Palette.ink};
`;

const Tagline = styled.div`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: Pixel;
  font-size: 0.8vw;
  color: ${Palette.muted};
`;
