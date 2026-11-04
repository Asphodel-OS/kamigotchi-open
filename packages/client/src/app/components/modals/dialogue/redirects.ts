import { VOTER_BADGE_INDICES } from 'network/shapes/Ballot';

// dialogue choices whose target depends on the player's state; null hides the choice
type Context = { getBalance: (itemIndex: number) => number };

// Alaina's "Show Badge": one line per badge tier (I-IV), hidden when the player holds none
const ALAINA_BADGE_LINES = [100016, 100017, 100018, 100019];

// items whose balances the redirects read; the dialogue modal re-renders when they change
export const REDIRECT_ITEM_INDICES = [...VOTER_BADGE_INDICES];

const redirects: Record<number, (ctx: Context) => number | null> = {
  100016: ({ getBalance }) => {
    for (let i = VOTER_BADGE_INDICES.length - 1; i >= 0; i--) {
      if (getBalance(VOTER_BADGE_INDICES[i]) > 0) return ALAINA_BADGE_LINES[i];
    }
    return null;
  },
};

export const resolveDialogueRedirect = (index: number, ctx: Context): number | null =>
  redirects[index] ? redirects[index](ctx) : index;
