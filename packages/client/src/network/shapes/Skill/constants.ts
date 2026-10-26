import { EntityID, EntityIndex } from 'engine/recs';

import { Skill } from './types';

export const NullSkill: Skill = {
  ObjectType: 'SKILL',
  id: '0' as EntityID,
  entity: 0 as EntityIndex,
  index: 0,
  name: '',
  description: '',
  image: '',
  cost: 0,
  max: 0,
  tier: 0,
  type: 'NONE',
  bonuses: [],
  requirements: [],
};
