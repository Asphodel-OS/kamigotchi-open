import { describe, expect, it } from 'vitest';

import { EntityID } from 'engine/recs';
import { canClaim } from './functions';
import { Contribution, Goal } from './types';

const goal = { complete: true, disabled: false } as Goal;
const contribution = (value: number): Contribution => ({
  holderID: '0x1' as EntityID,
  value,
  claimed: false,
});

describe('canClaim', () => {
  it('rejects an account that contributed nothing', () => {
    expect(canClaim(goal, contribution(0))[0]).toBe(false);
  });

  it('accepts an account that contributed', () => {
    expect(canClaim(goal, contribution(5))).toEqual([true, '']);
  });
});
