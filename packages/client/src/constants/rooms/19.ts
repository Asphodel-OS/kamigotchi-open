import { NpcImages } from 'assets/images/npcs';
import {
  bgDimiFrown,
  bgDimiLaugh,
  bgPlaytestDay,
} from 'assets/images/rooms/19_temple-of-the-wheel';
import { templeOfTheWheel } from 'assets/sound/ost';
import { Room } from './types';

export const room19: Room = {
  index: 19,
  backgrounds: [bgPlaytestDay],
  // dimidiatus' pose follows his dialogue mood: the room with his frowning or laughing pose in
  // place of the one painted in (both faces), the room behind him rebuilt from its mirror side.
  // his 'both' lines keep the room as painted
  moods: {
    [NpcImages['dimidiatus_frown.png']]: [bgDimiFrown],
    [NpcImages['dimidiatus_laugh.png']]: [bgDimiLaugh],
  },
  music: {
    key: 'templeOfTheWheel',
    path: templeOfTheWheel,
  },
  objects: [
    {
      name: 'black pool',
      coordinates: { x1: 35, y1: 95, x2: 95, y2: 107 },
      dialogue: 192,
    },
    {
      name: 'Dimidiatus',
      coordinates: { x1: 0, y1: 40, x2: 50, y2: 150 },
      dialogue: 20001,
    },
  ],
};
