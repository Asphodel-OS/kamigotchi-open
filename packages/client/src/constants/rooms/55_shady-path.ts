import { bgHalloween } from 'assets/images/rooms/55_shady-path';
import { k8 } from 'assets/sound/ost';
import { Room } from './types';

export const room55: Room = {
  index: 55,
  backgrounds: [bgHalloween, bgHalloween, bgHalloween],
  music: {
    key: 'k8',
    path: k8,
  },
  objects: [],
};
