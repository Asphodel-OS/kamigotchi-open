import { useEffect, useState } from 'react';
import styled from 'styled-components';

import { EmptyText, KamiBlock, TextTooltip } from 'app/components/library';
import { useVisibility } from 'app/stores';
import { Account } from 'network/shapes/Account';
import { Kami } from 'network/shapes/Kami';

export const KamiView = ({
  data,
  state,
  utils,
  isVisible,
}: {
  data: {
    account: Account;
  };
  state: {
    setQuantity: (balance: number) => void;
    selectedKamis: Kami[];
    setSelectedKamis: (chosenOnes: Kami[]) => void;
    tick: number;
  };
  utils: {
    getAccountKamis: () => Kami[];
    getSoulboundEnd: (kami: Kami) => number;
  };
  isVisible: boolean;
}) => {
  const { account } = data;
  const { setQuantity, selectedKamis, setSelectedKamis, tick } = state;
  const { getAccountKamis, getSoulboundEnd } = utils;
  const gachaModalVisible = useVisibility((s) => s.modals.gacha);

  const [partyKamis, setPartyKamis] = useState<Kami[]>([]);

  // update the list of kamis when the account changes (if visible)
  useEffect(() => {
    if (!isVisible || !gachaModalVisible) return;
    const party = getAccountKamis();
    setPartyKamis(party);
  }, [account, tick, gachaModalVisible]);

  /////////////////
  // INTERACTION

  // select or deselect a kami
  const handleSelect = (kami: Kami) => {
    if (!canReroll(kami)) return;

    let newSelected = [];
    if (selectedKamis.includes(kami)) {
      newSelected = selectedKamis.filter((k) => k !== kami);
    } else {
      newSelected = [...selectedKamis, kami];
    }
    setQuantity(newSelected.length);
    setSelectedKamis(newSelected);
  };

  /////////////////
  // INTERPRETATION

  // seconds left on a kami's soulbind
  const getBoundFor = (kami: Kami) => getSoulboundEnd(kami) - Date.now() / 1000;

  // determines whether a kami can be rerolled
  const canReroll = (kami: Kami) => {
    return kami.state === 'RESTING' && getBoundFor(kami) <= 0;
  };

  // get the tooltip of a kami based on state and reroll selection
  // maybe make the flavor text more randomized
  const getKamiTooltip = (kami: Kami): string[] => {
    if (selectedKamis.includes(kami)) return [`${kami.name} never liked you anyway..`];
    if (kami.state !== 'RESTING') {
      return [`${kami.name} is ${kami.state}`, '> only RESTING kamis can be rerolled'];
    }
    const boundFor = getBoundFor(kami);
    if (boundFor > 0) {
      return [`${kami.name} is soulbound`, `> can be rerolled in ${Math.ceil(boundFor / 3600)}h`];
    }
    return [`Reroll ${kami.name} ?`];
  };

  /////////////////
  // RENDER

  return (
    <Container isVisible={isVisible}>
      {partyKamis.length == 0 && <EmptyText text={['No Kamis?', 'Sad!']} size={1.8} />}
      {partyKamis.map((kami) => (
        <TextTooltip key={kami.index} text={getKamiTooltip(kami)}>
          <KamiBlock
            kami={kami}
            select={{
              isDisabled: !canReroll(kami),
              isSelected: selectedKamis.includes(kami),
              onClick: () => handleSelect(kami),
            }}
          />
        </TextTooltip>
      ))}
    </Container>
  );
};

const Container = styled.div<{ isVisible: boolean }>`
  position: relative;
  height: 100%;
  width: 100%;
  padding: 0.6vw;

  display: ${({ isVisible }) => (isVisible ? 'flex' : 'none')};
  flex-flow: row wrap;
  align-items: center;
  justify-content: center;

  overflow-y: scroll;

  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;
