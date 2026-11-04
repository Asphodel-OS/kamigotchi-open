import styled from 'styled-components';

import { playClick } from 'utils/sounds';

export type TabType = 'VOTE' | 'STREAK' | 'SCORE';

// each tab its own pastel tint, as the token portal's
const TABS: { key: TabType; label: string; color: string }[] = [
  { key: 'VOTE', label: 'Vote', color: '#E0EEFF' },
  { key: 'STREAK', label: 'Streak', color: '#FBEEBB' },
  { key: 'SCORE', label: 'Score', color: '#EDE4FF' },
];

export const Tabs = ({
  tab,
  setTab: _setTab,
}: {
  tab: TabType;
  setTab: (tab: TabType) => void;
}) => {
  // layer on a sound effect
  const setTab = (tab: TabType) => {
    playClick();
    _setTab(tab);
  };

  return (
    <Container>
      {TABS.map(({ key, label, color }, i) => (
        <Button
          key={key}
          $color={color}
          $active={tab === key}
          style={i < TABS.length - 1 ? { borderRight: 'solid black .15vw' } : undefined}
          onClick={() => setTab(key)}
          disabled={tab === key}
        >
          {label}
        </Button>
      ))}
    </Container>
  );
};

const Container = styled.div`
  width: 100%;
  border-top: solid black 0.15vw;
  background-color: white;
  display: flex;
  flex-flow: row nowrap;
  justify-content: space-between;
`;

const Button = styled.button<{ $color: string; $active: boolean }>`
  border: none;
  padding: 0.45vw;
  flex-grow: 1;
  color: black;
  justify-content: center;

  font-family: Pixel;
  font-size: 0.75vw;
  text-align: center;

  cursor: pointer;
  pointer-events: auto;
  background-color: ${({ $active, $color }) => ($active ? $color : 'white')};
  &:hover {
    background-color: ${({ $color }) => $color}88;
  }
  &:disabled {
    cursor: default;
    pointer-events: none;
  }
`;
