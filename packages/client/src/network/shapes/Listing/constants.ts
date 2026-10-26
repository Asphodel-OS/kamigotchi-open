import { EntityID, EntityIndex } from 'engine/recs';
import { NullItem } from '../Item';
import { Listing } from './types';

export const NullListing: Listing = {
  id: '0' as EntityID,
  entity: 0 as EntityIndex,
  item: NullItem,
  payItem: NullItem,
  value: 0,
  balance: 0,
  startTime: 0,
  requirements: [],
  buy: {
    type: 'FIXED',
  },
};
