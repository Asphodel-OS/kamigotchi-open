import { triggerGoalModal } from 'app/triggers/triggerGoalModal';
import { triggerOfferingModal } from 'app/triggers/triggerOfferingModal';
import { triggerPetNamingModal } from 'app/triggers/triggerPetNamingModal';
import {
  bgTremorsDay,
  bgTremorsEvening,
  bgTremorsNight,
} from 'assets/images/rooms/11_waterfall';
import { glitter } from 'assets/sound/ost';
import { Room } from './types';

export const room11: Room = {
  index: 11,
  backgrounds: [bgTremorsDay, bgTremorsEvening, bgTremorsNight],
  music: {
    key: 'glitter',
    path: glitter,
  },
  // lake and shore first: later boxes sit on top, so the shrine, lantern and board keep their clicks
  objects: [
    {
      name: 'lake shore',
      coordinates: { x1: 10, y1: 56, x2: 26, y2: 88 },
      onClick: triggerOfferingModal,
    },
    {
      name: 'lake',
      coordinates: { x1: 26, y1: 58, x2: 40, y2: 94 },
      onClick: triggerOfferingModal,
    },
    {
      name: 'lake',
      coordinates: { x1: 72, y1: 56, x2: 96, y2: 94 },
      onClick: triggerOfferingModal,
    },
    {
      name: 'lake',
      coordinates: { x1: 96, y1: 62, x2: 128, y2: 80 },
      onClick: triggerOfferingModal,
    },
    {
      name: 'waterfall',
      coordinates: { x1: 66, y1: 2, x2: 114, y2: 44 },
      dialogue: 113,
    },
    {
      name: 'ema board',
      coordinates: { x1: 93, y1: 80, x2: 127, y2: 114 },
      onClick: triggerPetNamingModal,
    },
    {
      name: 'stone lantern',
      coordinates: { x1: 3, y1: 88, x2: 24, y2: 110 },
      dialogue: 111,
    },
    {
      name: 'small shrine',
      coordinates: { x1: 40, y1: 58, x2: 72, y2: 102 },
      onClick: () => triggerGoalModal([14]),
    },
  ],
};
