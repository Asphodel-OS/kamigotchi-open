import { UIComponent } from 'app/root/types';
import { useSelected, useVisibility } from 'app/stores';
import { TutorialHint, TutorialStep } from './TutorialHint';
import { useTutorialQuest } from './useTutorialQuest';

// Guides players to Mina's shop for their first purchase: "Supporting Local Businesses" on
// the main world, "Smart Shopper" in the test world demo
const QUEST_INDICES = [8, 20012]; // MSQ008, DMQ12
const TUNNEL_ROOM = 2;
const SHOP_ROOM = 13;
const SHOP_DOOR_DIALOGUE = 23; // constants/dialogue/02_treetunnel.ts

const besideModal = (id: string) => ({ beside: id, offset: 1 / 3 });

export const ShopTutorial: UIComponent = {
  id: 'ShopTutorial',
  Render: () => {
    const roomIndex = useSelected((s) => s.roomIndex);
    const mapOpen = useVisibility((s) => s.modals.map);
    const dialogueVisible = useVisibility((s) => s.modals.dialogue);
    const dialogueIndex = useSelected((s) => s.dialogueIndex);
    // other Tunnel of Trees objects (the stump, the gate) open dialogues without an Enter button
    const dialogueOpen = dialogueVisible && dialogueIndex === SHOP_DOOR_DIALOGUE;
    const merchantOpen = useVisibility((s) => s.modals.merchant);
    const quest = useTutorialQuest(QUEST_INDICES);

    if (!quest) return null;
    const step = getStep(roomIndex, mapOpen, dialogueOpen, merchantOpen, quest.objectivesMet);
    return <TutorialHint {...step} />;
  },
};

const getStep = (
  roomIndex: number,
  mapOpen: boolean,
  dialogueOpen: boolean,
  merchantOpen: boolean,
  objectivesMet: boolean
): TutorialStep => {
  if (objectivesMet) return { highlight: 'quests_button' };
  if (roomIndex === SHOP_ROOM) {
    if (merchantOpen) {
      return {
        highlight: 'merchant',
        ...besideModal('merchant'),
        text: 'Buy anything using your $MUSU. Food heals your Kami, so it is a good place to start.',
      };
    }
    return {
      highlight: 'room-object-cashregister',
      text: 'Click the cash register to see what Mina is selling.',
    };
  }
  if (roomIndex === TUNNEL_ROOM) {
    if (dialogueOpen) {
      // the dialogue's action buttons get ids from their labels (Dialogue.tsx)
      return {
        highlight: 'dialogue-action-enter',
        beside: 'dialogue-action-enter',
        center: true,
        text: 'Click Enter to step inside.',
      };
    }
    return {
      highlight: 'room-object-shop-door',
      text: 'Click the glowing door to visit the shop.',
    };
  }
  if (mapOpen) {
    return {
      highlight: 'map',
      ...besideModal('map'),
      text: 'The gold tile marked ! is Tunnel of Trees, home of the shop door. Right-click it and choose Auto Travel, or walk there one tile at a time.',
    };
  }
  return { highlight: 'map_button', text: 'Mina runs a shop near the Torii Gate. Open your Map.' };
};
