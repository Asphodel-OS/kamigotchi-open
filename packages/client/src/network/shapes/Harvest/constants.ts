import { EntityID, EntityIndex } from 'engine/recs';
import { NullNode } from '../Node';
import { MULT_PREC } from '../Node/multiplier';
import { Harvest } from './types';

export const NullHarvest: Harvest = {
  id: '0' as EntityID,
  entity: 0 as EntityIndex,
  state: '',
  balance: 0,
  multiplier: MULT_PREC,
  rates: {
    fertility: 0,
    intensity: {
      average: 0,
      spot: 0,
    },
    total: {
      average: 0,
      spot: 0,
    },
    output: {
      average: 0,
      spot: 0,
    },
  },
  time: {
    last: 0,
    reset: 0,
    start: 0,
  },
  node: NullNode,
};
