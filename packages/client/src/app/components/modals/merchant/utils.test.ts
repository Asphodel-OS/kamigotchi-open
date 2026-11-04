import { describe, expect, it } from 'vitest';

import { Item } from 'network/shapes/Item';
import { Listing } from 'network/shapes/Listing';
import { clampQuantity, getCartTotals, getCurrencies, isShort } from './utils';

const item = (index: number, name: string) => ({ index, name }) as Item;
const BALLOT = item(13, 'Ballot');
const GOLDEN = item(14, 'Golden Ballot');

const listing = (itemIndex: number, payItem: Item, value: number) =>
  ({
    item: item(itemIndex, `item ${itemIndex}`),
    payItem,
    value,
    buy: { type: 'FIXED' },
  }) as Listing;

const BOOSTER = listing(21004, BALLOT, 5);
const BOX = listing(21008, GOLDEN, 1);

describe('getCurrencies', () => {
  it('lists each currency once, in listing order', () => {
    const extra = listing(1, BALLOT, 2);
    expect(getCurrencies([BOOSTER, BOX, extra]).map((c) => c.index)).toEqual([13, 14]);
  });
});

describe('getCartTotals', () => {
  const balances: Record<number, number> = { 13: 12, 14: 0 };
  const getBalance = (index: number) => balances[index] ?? 0;

  it('totals each currency on its own', () => {
    const totals = getCartTotals(
      [
        { listing: BOOSTER, quantity: 2 },
        { listing: BOX, quantity: 1 },
      ],
      getBalance
    );
    expect(totals.map((t) => [t.currency.index, t.amount, t.balance])).toEqual([
      [13, 10, 12],
      [14, 1, 0],
    ]);
    expect(totals.filter(isShort).map((t) => t.currency.index)).toEqual([14]);
  });

  it('adds listings that share a currency', () => {
    const totals = getCartTotals(
      [
        { listing: BOOSTER, quantity: 1 },
        { listing: listing(1, BALLOT, 2), quantity: 3 },
      ],
      getBalance
    );
    expect(totals).toHaveLength(1);
    expect(totals[0].amount).toBe(11);
    expect(isShort(totals[0])).toBe(false);
  });
});

describe('clampQuantity', () => {
  it('keeps quantities between 1 and 100', () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(250)).toBe(100);
    expect(clampQuantity(7.9)).toBe(7);
    expect(clampQuantity(NaN)).toBe(1);
  });
});
