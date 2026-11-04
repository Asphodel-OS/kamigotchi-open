import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

import { IconButton, TextTooltip } from 'app/components/library';
import { useVisibility } from 'app/stores';
import { triggerPoolModal } from 'app/triggers';
import { ActionIcons } from 'assets/images/icons/actions';
import { ArrowIcons } from 'assets/images/icons/arrows';
import { LpFountainIcon } from 'assets/images/icons/menu';
import { ItemImages } from 'assets/images/items';
import { Mode } from './types';

// get the row of consumable items to display in the player inventory
export const MusuRow = ({
  data,
  state,
}: {
  data: {
    musu: number;
    obols: number;
  };
  state: {
    mode: Mode;
    setMode: (mode: Mode) => void;
    setShuffle: (suffle: boolean) => void;
    query: string;
    setQuery: (query: string) => void;
  };
}) => {
  const { musu, obols } = data;
  const { mode, setMode, setShuffle, query, setQuery } = state;
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [displayMusu, setDisplayMusu] = useState<number>(musu);
  const animationRef = useRef<number | null>(null);
  const stepTimeRef = useRef<number | null>(null);
  const prevMusuRef = useRef<number>(musu);

  // animate the musu balance, eased to the target value
  useEffect(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    stepTimeRef.current = null;
    const from = prevMusuRef.current;
    const to = musu;

    // don't animate if the musu balance difference is low
    if (Math.abs(to - from) < 10) {
      prevMusuRef.current = musu;
      setDisplayMusu(to);
      return;
    }

    // animation step
    const step = (t: number) => {
      if (stepTimeRef.current == null) stepTimeRef.current = t;
      const elapsed = t - stepTimeRef.current;
      const progress = Math.min(1, elapsed / 750); // elapsed divided by tick duration
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + (to - from) * eased);
      setDisplayMusu(value);
      if (progress < 1) animationRef.current = requestAnimationFrame(step);
    };

    animationRef.current = requestAnimationFrame(step);
    prevMusuRef.current = musu;

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [musu]);

  /////////////////
  // INTERACTION

  // toggles views and activates the shuffle animation
  const triggerModalShuffle = () => {
    setMode(mode === 'STOCK' ? 'TRANSFER' : 'STOCK');
    closeSearch();
    setTimeout(() => setShuffle(true), 100);
    setTimeout(() => setShuffle(false), 500);
  };

  // the search field unfolds to the right of the icons; closing it clears the query
  const toggleSearch = () => {
    if (searching) closeSearch();
    else {
      setSearching(true);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  };

  const closeSearch = () => {
    searchRef.current?.blur();
    setSearching(false);
    setQuery('');
  };

  // open/close the pool modal. silent: the IconButton owns the click sound
  const togglePoolModal = () => {
    const { modals } = useVisibility.getState();
    if (modals.pool) useVisibility.setState({ modals: { ...modals, pool: false } });
    else triggerPoolModal({ silent: true });
  };

  /////////////////
  // RENDER

  return (
    <Container key='musu'>
      <Icons>
        <TextTooltip
          text={mode === 'TRANSFER' ? ['Back to Inventory'] : ['Send Item']}
          direction='row'
        >
          <IconButton
            img={mode === 'TRANSFER' ? ArrowIcons.left : ArrowIcons.right}
            onClick={() => triggerModalShuffle()}
            radius={0.9}
          />
        </TextTooltip>
        {mode !== 'TRANSFER' && (
          <TextTooltip text={['Item Pools']} direction='row'>
            <IconButton img={LpFountainIcon} onClick={togglePoolModal} radius={0.9} />
          </TextTooltip>
        )}
        {mode !== 'TRANSFER' && (
          <TextTooltip text={[searching ? 'Close search' : 'Search items']} direction='row'>
            <IconButton img={ActionIcons.search} onClick={toggleSearch} radius={0.9} />
          </TextTooltip>
        )}
        <SearchField
          ref={searchRef}
          $open={searching && mode !== 'TRANSFER'}
          disabled={!searching || mode === 'TRANSFER'}
          value={query}
          placeholder='item name'
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
        />
      </Icons>
      <MusuSection>
        <TextTooltip text={['MUSU']} direction='row'>
          <Chip>
            <Icon src={ItemImages.musu} />
            <Balance>{displayMusu.toLocaleString()}</Balance>
          </Chip>
        </TextTooltip>
      </MusuSection>
    </Container>
  );
};

const Container = styled.div`
  width: 100%;
  padding: 0.45vw;
  gap: 0.45vw;

  user-select: none;
  display: flex;
  flex-flow: row no-wrap;
  justify-content: space-between;
  align-items: center;
`;

const MusuSection = styled.div`
  position: relative;
  width: 100%;
  display: flex;
  flex-flow: row nowrap;
  justify-content: flex-end;
  align-items: center;
  gap: 0.3vw;
`;

const Chip = styled.div`
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 0.3vw;
`;

const Icons = styled.div`
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 0.3vw;
`;

const SearchField = styled.input<{ $open: boolean }>`
  width: ${({ $open }) => ($open ? '9vw' : '0')};
  padding: ${({ $open }) => ($open ? '0.3vw 0.45vw' : '0.3vw 0')};
  border: solid #333 ${({ $open }) => ($open ? '0.15vw' : '0')};
  border-radius: 0.6vw;
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  overflow: hidden;
  transition:
    width 0.25s ease,
    opacity 0.2s ease,
    padding 0.25s ease;

  font-family: Pixel;
  font-size: 0.75vw;
  color: black;
  background-color: white;
  outline: none;
  &::placeholder {
    color: #999;
  }
`;

const Icon = styled.img`
  width: 1.8vw;
  height: 1.8vw;
  margin-top: 0.12vw;
`;

const Balance = styled.div`
  border: solid #333 0.15vw;
  border-radius: 0.6vw 0 0.6vw 0.6vw;
  padding: 0.3vw;
  min-width: 9vw;

  display: flex;
  flex-flow: row nowrap;
  justify-content: flex-end;
  align-items: center;

  color: black;
  font-size: 0.9vw;
  line-height: 1.2vw;
`;
