import { UIComponent } from 'app/root/types';
import { useSelected, useVisibility } from 'app/stores';
import { TutorialHint, TutorialStep } from './TutorialHint';
import { useTutorialQuest } from './useTutorialQuest';

// Guides players through their first trip on the Map: "Beginning Your Journey" on the
// main world, "Find the Vending Machine" in the test world demo
const DESTINATIONS: Record<number, { room: number; place: string }> = {
  2: { room: 3, place: 'the Torii Gate' }, // MSQ002
  20001: { room: 4, place: 'the Vending Machine' }, // DMQ01
};
const QUEST_INDICES = Object.keys(DESTINATIONS).map(Number);

const OPEN: TutorialStep = {
  highlight: 'map_button',
  text: 'Click the Map button to open your Map.',
};
const ARRIVED: TutorialStep = { highlight: 'quests_button' };
const travel = (place: string): TutorialStep => ({
  highlight: 'map',
  beside: 'map',
  offset: 1 / 3,
  text: `The gold tile marked ! is ${place}. Right-click it and choose Auto Travel, or click a neighboring tile to walk one room at a time.`,
});

export const MapTutorial: UIComponent = {
  id: 'MapTutorial',
  Render: () => {
    const roomIndex = useSelected((s) => s.roomIndex);
    const mapOpen = useVisibility((s) => s.modals.map);
    const quest = useTutorialQuest(QUEST_INDICES);

    if (!quest) return null;
    const { room, place } = DESTINATIONS[quest.index];
    const step = roomIndex === room ? ARRIVED : mapOpen ? travel(place) : OPEN;
    return <TutorialHint {...step} />;
  },
};
