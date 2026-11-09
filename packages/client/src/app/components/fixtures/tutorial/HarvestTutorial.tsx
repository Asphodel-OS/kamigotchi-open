import { EntityIndex, getComponentValue } from 'engine/recs';
import { useEffect, useRef, useState } from 'react';

import { useLayers } from 'app/root/hooks';
import { UIComponent } from 'app/root/types';
import { useSelected, useVisibility } from 'app/stores';
import { queryAccountFromEmbedded, queryAccountKamis } from 'network/shapes/Account';
import { queryNodeByIndex } from 'network/shapes/Node';
import { TutorialHint, TutorialStep } from './TutorialHint';
import { useTutorialQuest } from './useTutorialQuest';

// Guides players through their first harvest: "What Kami Do: Harvesting" on the main world,
// "First Harvest" in the test world demo. They walk to a Node, harvest from the Node modal,
// then stop and restart from the Party modal to see the other way.
const QUEST_INDICES = [4, 20003]; // MSQ004, DMQ03
const POLL_MS = 1000;

// node: start a harvest from the Node modal. stop/restart: the same from the Party modal
type Stage = 'node' | 'stop' | 'restart' | 'done';

const NEXT_STAGE: Record<Stage, (harvesting: boolean) => Stage> = {
  node: (harvesting) => (harvesting ? 'stop' : 'node'),
  stop: (harvesting) => (harvesting ? 'stop' : 'restart'),
  restart: (harvesting) => (harvesting ? 'done' : 'restart'),
  done: () => 'done',
};

export const HarvestTutorial: UIComponent = {
  id: 'HarvestTutorial',
  Render: () => {
    const { network } = useLayers();
    const roomIndex = useSelected((s) => s.roomIndex);
    const mapOpen = useVisibility((s) => s.modals.map);
    const nodeOpen = useVisibility((s) => s.modals.node);
    const partyOpen = useVisibility((s) => s.modals.party);
    const ongoing = !!useTutorialQuest(QUEST_INDICES);

    const [stage, setStage] = useState<Stage>('node');
    const [inNodeRoom, setInNodeRoom] = useState(false);
    const stageAccount = useRef<EntityIndex>();

    // advance as the player's kamis start and stop harvesting. kept in memory only: a reload
    // just resumes from whatever the kamis are doing. a different account starts over
    useEffect(() => {
      if (!ongoing) return;
      const update = () => {
        const { world, components } = network;
        const { State } = components;
        const accountEntity = queryAccountFromEmbedded(network);
        if (!accountEntity) return;
        const kamis = queryAccountKamis(world, components, accountEntity);
        const harvesting = kamis.some((e) => getComponentValue(State, e)?.value === 'HARVESTING');
        setInNodeRoom(!!queryNodeByIndex(world, roomIndex));
        const sameAccount = stageAccount.current === accountEntity;
        stageAccount.current = accountEntity;
        setStage((current) => NEXT_STAGE[sameAccount ? current : 'node'](harvesting));
      };
      update();
      const id = setInterval(update, POLL_MS);
      return () => clearInterval(id);
    }, [network, ongoing, roomIndex]);

    if (!ongoing || stage === 'done') return null;
    const step = getStep(stage, inNodeRoom, mapOpen, nodeOpen, partyOpen);
    return <TutorialHint {...step} />;
  },
};

// beside the map or party, 1/3 of the way down, keeps the callout clear of the header and tiles
const besideModal = (id: string) => ({ beside: id, offset: 1 / 3 });

const getStep = (
  stage: Stage,
  inNodeRoom: boolean,
  mapOpen: boolean,
  nodeOpen: boolean,
  partyOpen: boolean
): TutorialStep => {
  if (stage === 'node') {
    if (!inNodeRoom) {
      if (!mapOpen) return { highlight: 'map_button', text: 'Open your Map to find a Node.' };
      return {
        highlight: 'map',
        ...besideModal('map'),
        text: 'Click a tile next to yours to walk there. Most rooms have a Node.',
      };
    }
    if (nodeOpen) {
      return {
        highlight: 'node_header',
        beside: 'node_header',
        text: 'Click Add Kami to Node and pick your Kami to start harvesting.',
      };
    }
    return {
      highlight: 'node_button',
      ...(mapOpen ? besideModal('map') : {}),
      text: 'This room has a Node. Click Harvest to open it.',
    };
  }
  if (!partyOpen) {
    return {
      highlight: 'party_button',
      ...(mapOpen ? besideModal('map') : {}),
      text: 'You can also harvest from your Party. Open it to see how.',
    };
  }
  if (stage === 'stop') {
    return {
      highlight: 'party',
      ...besideModal('party'),
      text: 'Click the Harvest button on your Kami and choose Stop. Harvest time counts when you stop.',
    };
  }
  return {
    highlight: 'party',
    ...besideModal('party'),
    text: 'Now use the same button to start again, once the short cooldown ends. Either way works!',
  };
};
