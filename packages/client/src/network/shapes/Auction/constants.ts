import { EntityID, EntityIndex } from 'engine/recs';
import { Auction } from './types';

export const NullAuction: Auction = {
  id: '0' as EntityID,
  entity: 0 as EntityIndex,
  ObjectType: 'AUCTION',
  params: {
    value: 0,
    period: 0,
    decay: 0,
    rate: 0,
  },
  supply: {
    sold: 0,
    total: 0,
  },
  time: {
    start: 0,
    pause: { start: 0, end: 0 },
  },
};
