import { NpcImages } from 'assets/images/npcs';
import {
  bgClaspingHandsDay,
  bgClaspingHandsEvening,
  bgClaspingHandsNight,
  bgHappyDay,
  bgHappyEvening,
  bgHappyNight,
  bgLostInThoughtDay,
  bgLostInThoughtEvening,
  bgLostInThoughtNight,
  bgNoAlainaDay,
  bgNoAlainaEvening,
  bgNoAlainaNight,
  bgPlaytestDay,
  bgPlaytestEvening,
  bgPlaytestNight,
} from 'assets/images/rooms/64_burning-room';
import { k3 } from 'assets/sound/ost';

import { Room } from './types';

export const room64: Room = {
  index: 64,
  backgrounds: [bgPlaytestDay, bgPlaytestEvening, bgPlaytestNight],
  music: {
    key: 'k3',
    path: k3,
  },
  // alaina's pose follows her dialogue mood, drawn behind the cauldron
  moodBase: [bgNoAlainaDay, bgNoAlainaEvening, bgNoAlainaNight],
  moods: {
    [NpcImages['alaina_clasping_hands.png']]: [
      bgClaspingHandsDay,
      bgClaspingHandsEvening,
      bgClaspingHandsNight,
    ],
    [NpcImages['alaina_happy.png']]: [bgHappyDay, bgHappyEvening, bgHappyNight],
    [NpcImages['alaina_lost_in_thought.png']]: [
      bgLostInThoughtDay,
      bgLostInThoughtEvening,
      bgLostInThoughtNight,
    ],
  },
  objects: [
    {
      name: 'alaina',
      coordinates: { x1: 6, y1: 2, x2: 58, y2: 108 },
      dialogue: 100001,
    },
    {
      name: 'frog',
      coordinates: { x1: 103, y1: 89, x2: 124, y2: 105 },
      dialogue: 642,
    },
    {
      name: 'hut exit',
      coordinates: { x1: 52, y1: 110, x2: 76, y2: 130 },
      dialogue: 641,
    },
  ],
};
