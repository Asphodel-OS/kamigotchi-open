import { bgHalloween, bgHalloweenPlainsight } from 'assets/images/rooms/56_butterfly-forest';
import { k8 } from 'assets/sound/ost';
import { IGOR_REVEAL_QUEST_INDEX, IGOR_TRICK_OR_TREAT_QUEST_INDEX } from 'constants/quests';

import { Room } from './types';

// Igor hides in the witch house until the reveal, then stands in plain sight
export const room56: Room = {
  index: 56,
  backgrounds: [bgHalloween, bgHalloween, bgHalloween],
  questBackgrounds: {
    after: IGOR_REVEAL_QUEST_INDEX,
    backgrounds: [bgHalloweenPlainsight, bgHalloweenPlainsight, bgHalloweenPlainsight],
  },
  music: {
    key: 'k8',
    path: k8,
  },
  objects: [
    {
      name: 'igor',
      coordinates: { x1: 34, y1: 38, x2: 90, y2: 125 },
      dialogue: 90001,
      quest: { after: IGOR_REVEAL_QUEST_INDEX, before: IGOR_TRICK_OR_TREAT_QUEST_INDEX },
    },
    {
      name: 'igor',
      coordinates: { x1: 34, y1: 38, x2: 90, y2: 125 },
      dialogue: 90101,
      quest: { after: IGOR_TRICK_OR_TREAT_QUEST_INDEX },
    },
  ],
};
