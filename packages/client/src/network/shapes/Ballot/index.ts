import { EntityID, World } from 'engine/recs';

import { Components } from 'network/';
import { getConfigFieldValueArray } from '../Config';
import { getData } from '../Data';

// mirrors LibBallot (packages/contracts/src/libraries/LibBallot.sol). Ballots never touch VIPP or VIP score
export const BALLOT_INDEX = 13;
export const GOLDEN_BALLOT_INDEX = 14;
export const VOTER_BADGE_INDICES = [15, 16, 17, 18]; // I-IV
export const MILESTONES = [5, 10, 26, 52]; // badges I-IV, once per account
const MILESTONE_REWARDS = [...VOTER_BADGE_INDICES, GOLDEN_BALLOT_INDEX];
export const STREAK_CAP = 52;
const CYCLE_LENGTH = 1209600;
const NULL_HOLDER = '0' as EntityID; // per cycle/epoch totals hang off holder 0

export interface BallotConfig {
  pool: number;
  graceRefill: number;
  floor: number;
  goldenEvery: number;
  streakMin: number; // least yominet share (0-1) of a vote that builds the streak
  streakPower: number; // and the least yominet power, whole INIT
  goldenPower: number; // least yominet power for a golden ballot, whole INIT (0: off)
  caps: number[]; // band caps, whole INIT
  divs: number[]; // INIT per Ballot within each band
  floorMin: number; // INIT from which the floor applies
}

/////////////////
// CONFIG + CYCLES

// BALLOT_RATES: [pool, graceRefill, floor, goldenEvery, streakShare (bps), streakPower, goldenPower,
// goldenCap]
// BALLOT_TIERS: [cap1, cap2, cap3, div1, div2, div3, div4, floorMin]
export const getBallotConfig = (world: World, comps: Components): BallotConfig => {
  const r = getConfigFieldValueArray(world, comps, 'BALLOT_RATES');
  const t = getConfigFieldValueArray(world, comps, 'BALLOT_TIERS');
  const rated = r[0] > 0;
  const tiered = t[3] > 0;
  const floorMin = tiered ? t[7] : 10;
  return {
    pool: r[0] || 10000,
    graceRefill: r[1] || 13,
    floor: rated ? r[2] : 1,
    goldenEvery: r[3] || 5,
    streakMin: (r[4] || 10000) / 10000,
    streakPower: Math.max(rated ? r[5] : 100, floorMin),
    goldenPower: rated ? r[6] : 0,
    caps: tiered ? t.slice(0, 3) : [5000, 50000, 150000],
    divs: tiered ? t.slice(3, 7) : [30, 60, 90, 120],
    floorMin,
  };
};

// yominet's view of the current cycle/epoch and when it ends, exactly as LibBallot.getCycle
// (settles key off this). BALLOT_CYCLE: [start, length, base], 0s until configured
export const getCycleClock = (
  world: World,
  comps: Components,
  now = Math.floor(Date.now() / 1000)
) => {
  const [start, length, base] = getConfigFieldValueArray(world, comps, 'BALLOT_CYCLE');
  const len = length || CYCLE_LENGTH;
  const elapsed = Math.floor(Math.max(now - start, 0) / len);
  const end = start + (elapsed + 1) * len;
  return { configured: start > 0, base, cycle: base + elapsed, length: len, end };
};

/////////////////
// SETTLES + STREAK

export const isSettled = (world: World, comps: Components, accID: EntityID, cycle: number) =>
  getData(world, comps, accID, 'BALLOT_SETTLED', cycle) > 0;

// streak as of a cycle/epoch's settle; only streak votes record one

export const getStreakAt = (world: World, comps: Components, accID: EntityID, cycle: number) =>
  getData(world, comps, accID, 'BALLOT_STREAK', cycle);

// a vote builds the streak from a BALLOT_RATES[4] yominet share (judged by the reporter) and
// BALLOT_RATES[5] INIT on yominet (checked by LibBallot). power in raw uinit, as L1 reports it
export const isStreakVote = (cfg: BallotConfig, yominetWeight: number, yominetPower: number) =>
  yominetWeight > 0 && yominetWeight >= cfg.streakMin && yominetPower >= cfg.streakPower * 1e6;

export const getGraceCycle = (world: World, comps: Components, accID: EntityID) =>
  getData(world, comps, accID, 'BALLOT_GRACE_CYCLE');

// badges pay once each, up to the best streak ever settled
export const hasMilestone = (world: World, comps: Components, accID: EntityID, step: number) =>
  getData(world, comps, accID, 'BALLOT_STREAK_BEST') >= step;

// settled but unclaimed: ballots at (0, BALLOT_OWED), milestone rewards at (itemIndex, BALLOT_OWED).
// the reporter settles in batches, so yominet only records what's owed until the account claims
export const getOwed = (world: World, comps: Components, accID: EntityID) => {
  const rewards = MILESTONE_REWARDS.map((index) => ({
    index,
    amount: getData(world, comps, accID, 'BALLOT_OWED', index),
  })).filter((r) => r.amount > 0);
  return {
    ballots: getData(world, comps, accID, 'BALLOT_OWED'),
    items: rewards.reduce((sum, r) => sum + r.amount, 0),
    rewards, // owed golden ballots and badges, by item index
  };
};

// summed voter weight (millionths of a Ballot) locked by a cycle/epoch's first settle; 0 until then
export const getEligibleWeight = (world: World, comps: Components, cycle: number) =>
  getData(world, comps, NULL_HOLDER, 'BALLOT_ELIGIBLE_WEIGHT', cycle);

/////////////////
// MATHS (mirrors LibBallot)

// tiered weight of yominet power in millionths of a Ballot. power in raw uinit (1 INIT = 1e6), as
// L1 reports it; bigint, since power * pool can pass 2^53
export const calcWeight = (cfg: BallotConfig, power: number) => {
  const p = BigInt(Math.floor(power));
  let w = 0n;
  let lo = 0n;
  for (let i = 0; i < 4 && p > lo; i++) {
    const hi = i < 3 ? BigInt(cfg.caps[i]) * 1_000_000n : p;
    w += ((p < hi ? p : hi) - lo) / BigInt(cfg.divs[i]);
    lo = hi;
  }
  return w;
};

// Ballots for a cycle/epoch: the weight, cut to the pool share, never under the floor
export const calcBase = (cfg: BallotConfig, power: number, eligible: number) => {
  const w = calcWeight(cfg, power);
  const atRate = w / 1_000_000n;
  const atPool = (w * BigInt(cfg.pool)) / BigInt(Math.max(Math.floor(eligible), 1));
  const base = Number(atRate < atPool ? atRate : atPool);
  return power >= cfg.floorMin * 1e6 && base < cfg.floor ? cfg.floor : base;
};
