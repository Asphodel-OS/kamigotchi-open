import styled from 'styled-components';

import { playClick } from 'utils/sounds';
import { TAB_LABELS, TABS, TabType } from '../types';

export const Tabs = ({ tab, setTab }: { tab: TabType; setTab: (tab: TabType) => void }) => {
  // layer on a sound effect
  const handleTab = async (tab: TabType) => {
    playClick();
    setTab(tab);
  };

  return (
    <Container>
      {TABS.map((t, i) => (
        <Button
          key={t}
          onClick={() => handleTab(t)}
          disabled={tab === t}
          isActive={tab === t}
          style={{ borderLeft: i == 0 ? '' : 'solid black .15vw' }}
        >
          {TAB_LABELS[t]}
        </Button>
      ))}
    </Container>
  );
};

const Container = styled.div`
  border-bottom: 0.15vw solid black;

  display: flex;
  width: 100%;

  flex-flow: row nowrap;
  align-items: center;
  justify-content: space-around;
`;

const Button = styled.button<{ isActive: boolean }>`
  border: none;
  border-bottom: 0.3vw solid ${({ isActive }) => (isActive ? '#6c6' : 'transparent')};
  padding: 1.2vw 1.2vw 0.9vw;
  background-color: #fff;
  color: ${({ isActive }) => (isActive ? '#000' : '#555')};
  justify-content: center;
  align-items: center;
  width: 100%;

  font-size: 1.2vw;
  text-align: center;

  cursor: pointer;
  pointer-events: auto;
  user-select: none;
  &:active {
    background-color: #111;
  }
  &:hover {
    background-color: #ddd;
  }
  &:disabled {
    background-color: #efe;
    cursor: default;
    pointer-events: none;
  }
`;
