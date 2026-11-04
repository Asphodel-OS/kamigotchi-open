import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildVoteMsg, getWeightVote } from 'network/initia/vote';
import { BallotConfig, calcBase, calcWeight, isStreakVote } from '.';

const cfg: BallotConfig = {
  pool: 10000,
  graceRefill: 13,
  floor: 1,
  goldenEvery: 5,
  streakMin: 0.75,
  streakPower: 100,
  goldenPower: 0,
  caps: [5000, 50000, 150000],
  divs: [30, 60, 90, 120],
  floorMin: 10,
};

// mirrors LibBallot; a drift here means the estimates disagree with the contracts
describe('ballot maths', () => {
  it('weights power by tier, in millionths of a Ballot', () => {
    expect(calcWeight(cfg, 1e6)).toBe(33_333n);
    expect(calcWeight(cfg, 5_000e6)).toBe(166_666_666n);
    expect(calcWeight(cfg, 100_000e6)).toBe(166_666_666n + 750_000_000n + 555_555_555n);
    expect(calcWeight(cfg, 367653402908)).toBe(3_841_556_134n);
  });

  it('pays the pool share, capped by the rate, never under the floor', () => {
    expect(calcBase(cfg, 367653402908, 18547294868)).toBe(2071); // cycle/epoch 38
    expect(calcBase(cfg, 100_000e6, 1_472_222_221)).toBe(1472); // alone: capped by the rate
    expect(calcBase(cfg, 10e6, 1e6)).toBe(1); // 10 INIT: floored
    expect(calcBase(cfg, 5e6, 1e6)).toBe(0); // under the floor's minimum
  });

  it('builds the streak from the threshold share and power up', () => {
    expect(isStreakVote(cfg, 1, 100e6)).toBe(true);
    expect(isStreakVote(cfg, 0.75, 100e6)).toBe(true);
    expect(isStreakVote(cfg, 0.74, 100e6)).toBe(false);
    expect(isStreakVote(cfg, 1, 99e6)).toBe(false); // dust can't farm golden ballots
    expect(isStreakVote({ ...cfg, streakMin: 1 }, 0.99, 100e6)).toBe(false);
  });

  // L1 view stub: one canned result per weight_vote function, or a failed view
  const stubL1 = (results: Record<string, unknown>) =>
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      const fn = JSON.parse(init.body).function_name as string;
      if (!(fn in results)) return { ok: false, json: async () => ({ message: `${fn} aborted` }) };
      return { ok: true, json: async () => ({ data: JSON.stringify(results[fn]) }) };
    });
  afterEach(() => vi.unstubAllGlobals());

  it('sums every yominet entry of a vote, truncating each as L1 tallies them', async () => {
    stubL1({
      get_weight_vote: {
        max_voting_power: '1000000007',
        weights: [
          { bridge_id: '11', weight: '0.4' },
          { bridge_id: '32', weight: '0.2' },
          { bridge_id: '11', weight: '0.4' },
        ],
      },
    });
    const vote = await getWeightVote(40, '0x1');
    expect(vote.yominetWeight).toBe(0.8);
    expect(vote.yominetPower).toBe(400000002 * 2); // trunc(0.4 x mvp) per entry
  });

  it('reads a cycle/epoch L1 has not opened yet as no vote', async () => {
    stubL1({ get_module_store: { current_cycle: '40' } });
    expect((await getWeightVote(41, '0x1')).voted).toBe(false);
    await expect(getWeightVote(40, '0x1')).rejects.toThrow('get_weight_vote aborted');
  });

  // bytes of a real mainnet vote: init16h5g3…ncr, cycle/epoch 39, 100% Yominet
  // (L1 height 22803703)
  it('encodes weight_vote::vote like a real cycle 39 vote', () => {
    const { value } = buildVoteMsg('init1x', 39);
    const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');
    expect(value.args.map(b64)).toEqual(['JwAAAAAAAAA=', 'AQsAAAAAAAAA', 'AQgAAGSns7bgDQ==']);
  });
});
