import { describe, expect, it } from 'vitest';

import {
  MULT_PREC,
  formatMultiplier,
  getStoredMultiplier,
  hasStoredCopy,
  scaleByMultiplier,
} from 'network/shapes/Node/multiplier';
import { settleStretch } from './calcs';

describe('stored multipliers (K in the low 16 bits, as LibNode and LibHarvest store it)', () => {
  it('reads K in decimal and hex form', () => {
    expect(getStoredMultiplier(800)).toBe(800);
    expect(getStoredMultiplier('2500')).toBe(2500);
    expect(getStoredMultiplier('0x' + (60000).toString(16))).toBe(60000);
  });

  it('reads only the low 16 bits of a value with higher bits set', () => {
    const earlier = (1n << 255n) | (500n << 16n) | 800n; // higher bits set
    expect(getStoredMultiplier(earlier)).toBe(800);
    expect(getStoredMultiplier('0x' + earlier.toString(16))).toBe(800);
  });

  it('has no default: nothing stored reads 0, which marks a harvest without a copy', () => {
    expect(getStoredMultiplier(undefined)).toBe(0);
    expect(getStoredMultiplier(0)).toBe(0);
    expect(hasStoredCopy(undefined)).toBe(false);
    expect(hasStoredCopy(0)).toBe(false);
    expect(hasStoredCopy(1000)).toBe(true);
    expect(hasStoredCopy('100')).toBe(true);
  });
});

describe('settleStretch (as LibHarvest.calcCredit)', () => {
  it("credits today's bounty × K, rounded to the nearest whole MUSU", () => {
    expect(settleStretch(MULT_PREC, 5)).toBe(5);
    expect(settleStretch(1500, 5)).toBe(8); // 7.5
    expect(settleStretch(1500, 3)).toBe(5); // 4.5
    expect(settleStretch(1100, 3)).toBe(3); // 3.3
    expect(settleStretch(1100, 9)).toBe(10); // 9.9
    expect(settleStretch(2000, 5)).toBe(10);
    expect(settleStretch(60000, 1)).toBe(60);
    expect(settleStretch(100, 4)).toBe(0); // 0.4
    expect(settleStretch(60000, 0)).toBe(0);
  });
});

describe('display', () => {
  it('scales a rate by K', () => {
    expect(scaleByMultiplier(800, 24.5)).toBeCloseTo(19.6);
    expect(scaleByMultiplier(1500, 24.5)).toBeCloseTo(36.75);
  });

  it('labels anything but 1.0, exact to the per mille', () => {
    expect(formatMultiplier(MULT_PREC)).toBe('');
    expect(formatMultiplier(800)).toBe('×0.8');
    expect(formatMultiplier(2500)).toBe('×2.5');
    expect(formatMultiplier(1234)).toBe('×1.234');
  });
});
