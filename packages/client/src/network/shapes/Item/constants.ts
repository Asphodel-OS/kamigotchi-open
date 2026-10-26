import { EntityID, EntityIndex } from 'engine/recs';
import { Item } from './types';

export const NullItem: Item = {
  ObjectType: 'ITEM',
  id: '0' as EntityID,
  entity: 0 as EntityIndex,
  index: 0,
  type: '',
  rarity: 0,
  for: '',
  image: '',
  name: 'None',
  requirements: { use: [] },
  effects: { use: [], equip: [] },
  is: {
    disabled: false,
    tradeable: false,
  },
};
