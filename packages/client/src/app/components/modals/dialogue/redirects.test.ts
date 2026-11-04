import { describe, expect, it } from 'vitest';

import { VOTER_BADGE_INDICES } from 'network/shapes/Ballot';
import { resolveDialogueRedirect } from './redirects';

const holding = (...items: number[]) => ({
  getBalance: (itemIndex: number) => (items.includes(itemIndex) ? 1 : 0),
});

describe('resolveDialogueRedirect', () => {
  it('leaves unconditional dialogues alone', () => {
    expect(resolveDialogueRedirect(100001, holding())).toBe(100001);
  });

  it('hides the choice when the player holds no badge', () => {
    expect(resolveDialogueRedirect(100016, holding())).toBeNull();
  });

  it('picks the line for the highest badge held', () => {
    const [i, ii, iii, iv] = VOTER_BADGE_INDICES;
    expect(resolveDialogueRedirect(100016, holding(i))).toBe(100016);
    expect(resolveDialogueRedirect(100016, holding(i, ii))).toBe(100017);
    expect(resolveDialogueRedirect(100016, holding(iii))).toBe(100018);
    expect(resolveDialogueRedirect(100016, holding(i, iv))).toBe(100019);
  });
});
