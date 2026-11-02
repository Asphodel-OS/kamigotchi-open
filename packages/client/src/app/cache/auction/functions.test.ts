import { describe, expect, it } from 'vitest';

import type { Auction } from 'network/shapes/Auction';
import { getPriceStart, unpackPause } from 'network/shapes/Auction/pricing';
import { calcPrice } from './functions';

const DAY = 86400;
const START = 1_700_000_000;
const PAUSE = { start: START + DAY, end: START + 4 * DAY }; // a 3-day halt after day 1

// the live Gacha <> Musu curve
const auction = (pause = { start: 0, end: 0 }): Auction =>
  ({
    auctionItem: { index: 10 },
    params: { value: 32000, period: DAY, decay: 0.75, rate: 32 },
    supply: { sold: 0, total: 17222 },
    time: { start: START, pause },
  }) as unknown as Auction;

describe('unpackPause (as LibAuctionRegistry.packPause)', () => {
  it('reads uint64 start << 64 | uint64 end', () => {
    const packed = (BigInt(PAUSE.start) << 64n) | BigInt(PAUSE.end);
    expect(unpackPause(packed)).toEqual(PAUSE);
    expect(unpackPause('0x' + packed.toString(16))).toEqual(PAUSE); // the decoder's hex form
  });

  it('is empty when unset', () => {
    expect(unpackPause(undefined)).toEqual({ start: 0, end: 0 });
  });
});

describe('getPriceStart (as LibAuction.getPriceStart)', () => {
  it('is the start without a pause', () => {
    expect(getPriceStart(auction(), START + 5 * DAY)).toBe(START);
  });

  it('skips nothing before the window', () => {
    expect(getPriceStart(auction(PAUSE), PAUSE.start)).toBe(START);
  });

  it('stands still during the window', () => {
    expect(getPriceStart(auction(PAUSE), PAUSE.start + DAY)).toBe(START + DAY);
  });

  it('skips the whole window after it', () => {
    expect(getPriceStart(auction(PAUSE), PAUSE.end + DAY)).toBe(START + 3 * DAY);
  });
});

describe('calcPrice across a pause', () => {
  it('history before the pause is unchanged', () => {
    expect(calcPrice(auction(PAUSE), START + DAY / 2, 0)).toBe(calcPrice(auction(), START + DAY / 2, 0));
  });

  it('the price holds through the pause and resumes where it was', () => {
    const atPause = calcPrice(auction(), PAUSE.start, 0);
    expect(calcPrice(auction(PAUSE), PAUSE.start + DAY, 0)).toBe(atPause);
    expect(calcPrice(auction(PAUSE), PAUSE.end, 0)).toBe(atPause);
    expect(calcPrice(auction(), PAUSE.end, 0)).toBeLessThan(atPause); // without the window
  });
});
