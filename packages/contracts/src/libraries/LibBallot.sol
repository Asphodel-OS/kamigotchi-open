// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { IUint256Component as IUintComp } from "solecs/interfaces/IUint256Component.sol";
import { IWorld } from "solecs/interfaces/IWorld.sol";
import { LibTypes } from "solecs/LibTypes.sol";

import { LibEmitter } from "libraries/utils/LibEmitter.sol";
import { LibConfig } from "libraries/LibConfig.sol";
import { LibData } from "libraries/LibData.sol";
import { LibInventory } from "libraries/LibInventory.sol";
import { LibItem } from "libraries/LibItem.sol";

uint32 constant BALLOT_INDEX = 13;
uint32 constant GOLDEN_BALLOT_INDEX = 14;
uint32 constant VOTER_BADGE_I_INDEX = 15; // badges I-IV are 15-18
uint256 constant SETTLE_WINDOW = 7; // cycles/epochs back from the current one; the job re-checks 6

/** @notice
 * LibBallot handles Ballots: earned by voting for Yominet in Initia's VIP gauge, read off
 * Initia L1 and reported by the ballot reporter, spent at merchant listings priced in Ballots.
 * Ballots never touch VIPP or VIP score.
 *
 * Configs (LibConfig arrays):
 *   - BALLOT_CYCLE: [start, length, base] gauge cycle/epoch `base` starts at `start`;
 *     earlier cycles/epochs never settle
 *   - BALLOT_RATES: [pool, graceRefill, floor, goldenEvery, streakShare, streakPower, goldenPower,
 *     goldenCap]: streakShare (bps) is the least yominet share of a streak vote, judged off chain
 *     by the reporter; streakPower (INIT, at least floorMin) is the least yominet power that builds
 *     a streak; goldenPower (INIT) and goldenCap (per cycle/epoch) are levers against farming, 0 = off
 *   - BALLOT_TIERS: [cap1, cap2, cap3, div1, div2, div3, div4, floorMin]: power earns 1 Ballot
 *     per divN INIT within each band (caps in whole INIT); floorMin INIT or more earns >= floor,
 *     until the cycle/epoch's pool is spent
 * @dev kept apart from VIP_STAGE (LibVIP.getStage): ballots never touch LibVIP, and nothing on
 * chain proves the L1 gauge cycle/epoch and the VIP stage share boundaries
 *
 * Data (LibData, holder = account):
 *   - (cycle, "BALLOT_SETTLED"): 1 once the account's cycle/epoch is settled
 *   - (cycle, "BALLOT_POWER"): the yominet power it was settled with, which the job checks against L1
 *   - (cycle, "BALLOT_STREAK"): streak as of that cycle/epoch's settle, streak votes only (0 = none)
 *   - (0, "BALLOT_STREAK_BEST"): best streak settled, badges <= it have been owed
 *   - (0, "BALLOT_GRACE_CYCLE"): the missed cycle/epoch last bridged by grace (0 = never)
 *   - (0, "BALLOT_LAST_CYCLE"): latest cycle/epoch settled; earlier ones settle without a streak
 *   - (0, "BALLOT_OWED"): ballots settled but not yet claimed
 *   - (itemIndex, "BALLOT_OWED"): badges/golden ballots settled but not yet claimed
 *   - (BALLOT_INDEX, "ITEM_TOTAL"): ballots earned
 *
 * Per cycle/epoch, on holder 0:
 *   - (cycle, "BALLOT_VOTERS"): accounts settled
 *   - (cycle, "BALLOT_ELIGIBLE_WEIGHT"): summed voter weight, locked by the first settle
 *   - (cycle, "BALLOT_CYCLE_WEIGHT"): weight settled so far, never above the eligible weight
 *   - (cycle, "BALLOT_CYCLE_MINTED"): ballots settled, never above the pool
 *   - (cycle, "BALLOT_CYCLE_GOLDEN"): golden ballots owed
 */
library LibBallot {
  /////////////////
  // CYCLES

  /// @notice current gauge cycle/epoch number on yominet
  function getCycle(IUintComp comps) internal view returns (uint256) {
    uint32[8] memory c = LibConfig.getArray(comps, "BALLOT_CYCLE");
    require(c[0] != 0 && c[1] != 0, "Ballot: cycles not configured");
    require(block.timestamp >= c[0], "Ballot: cycles not started");
    return c[2] + (block.timestamp - c[0]) / c[1];
  }

  function getRates(IUintComp comps) internal view returns (uint32[8] memory) {
    return LibConfig.getArray(comps, "BALLOT_RATES");
  }

  function getTiers(IUintComp comps) internal view returns (uint32[8] memory) {
    return LibConfig.getArray(comps, "BALLOT_TIERS");
  }

  /////////////////
  // SETTLE

  function isSettled(IUintComp comps, uint256 accID, uint256 cycle) internal view returns (bool) {
    return LibData.get(comps, accID, uint32(cycle), "BALLOT_SETTLED") != 0;
  }

  /// @notice records a settle and adds ballots and milestone items to the owed balance. only streak
  /// votes (yominet share >= BALLOT_RATES[4], judged by the reporter) build the streak
  function settle(
    IUintComp comps,
    uint256 accID,
    uint256 cycle,
    uint256 power,
    uint256 eligible,
    bool streakVote
  ) internal returns (uint256 ballots, uint256 streak) {
    require(power > 0, "Ballot: no yominet power");
    verifyCycle(comps, accID, cycle);
    LibData.set(comps, accID, uint32(cycle), "BALLOT_SETTLED", 1);
    LibData.set(comps, accID, uint32(cycle), "BALLOT_POWER", power);
    LibData.inc(comps, 0, uint32(cycle), "BALLOT_VOTERS", 1);

    uint32[8] memory r = getRates(comps);
    uint32[8] memory t = getTiers(comps);
    ballots = settleBallots(comps, cycle, power, eligible, r, t);
    if (ballots > 0) LibData.inc(comps, accID, 0, "BALLOT_OWED", ballots);
    streak = settleStreak(comps, accID, cycle, power, streakVote, r, t);
  }

  /// @notice settles only closed cycles/epochs from launch, within SETTLE_WINDOW, once per account
  function verifyCycle(IUintComp comps, uint256 accID, uint256 cycle) internal view {
    uint256 current = getCycle(comps);
    require(
      cycle > 0 && cycle >= LibConfig.getArray(comps, "BALLOT_CYCLE")[2],
      "Ballot: cycle before launch"
    );
    require(cycle < current, "Ballot: cycle still open");
    require(cycle + SETTLE_WINDOW >= current, "Ballot: cycle too old");
    require(!isSettled(comps, accID, cycle), "Ballot: cycle already settled");
  }

  /// @notice the voter's ballots: weight bounded by the locked eligible weight, the pool share,
  /// and the pool itself once floors would pass it
  function settleBallots(
    IUintComp comps,
    uint256 cycle,
    uint256 power,
    uint256 eligible,
    uint32[8] memory r,
    uint32[8] memory t
  ) internal returns (uint256) {
    require(r[0] > 0, "Ballot: rates not configured");
    require(t[3] > 0 && t[4] > 0 && t[5] > 0 && t[6] > 0, "Ballot: tiers not configured");
    uint256 weight = calcWeight(t, power);
    boundByWeight(comps, cycle, weight, eligible);
    return capByPool(comps, cycle, r[0], calcBase(r, t, power, weight, eligible));
  }

  /// @notice the streak only builds in order (a late settle of an earlier cycle/epoch would count
  /// it twice) and from streakPower INIT, so dust wallets can't farm golden ballots
  function settleStreak(
    IUintComp comps,
    uint256 accID,
    uint256 cycle,
    uint256 power,
    bool streakVote,
    uint32[8] memory r,
    uint32[8] memory t
  ) internal returns (uint256 streak) {
    bool inOrder = cycle > LibData.get(comps, accID, 0, "BALLOT_LAST_CYCLE");
    if (inOrder) LibData.set(comps, accID, 0, "BALLOT_LAST_CYCLE", cycle);
    uint256 streakPower = uint256(r[5] > t[7] ? r[5] : t[7]) * 1e6;
    if (!streakVote || !inOrder || power < streakPower) return 0;
    streak = calcStreak(comps, accID, cycle, r[1]);
    LibData.set(comps, accID, uint32(cycle), "BALLOT_STREAK", streak);
    oweMilestones(comps, accID, cycle, power, streak, r);
  }

  /// @notice floors are paid on top of the pool split, so cut them once a cycle/epoch's pool is
  /// spent: a cycle/epoch never mints more than the pool
  function capByPool(
    IUintComp comps,
    uint256 cycle,
    uint256 pool,
    uint256 ballots
  ) internal returns (uint256) {
    uint256 minted = LibData.get(comps, 0, uint32(cycle), "BALLOT_CYCLE_MINTED");
    if (minted + ballots > pool) ballots = pool > minted ? pool - minted : 0;
    if (ballots > 0) LibData.inc(comps, 0, uint32(cycle), "BALLOT_CYCLE_MINTED", ballots);
    return ballots;
  }

  /// @notice recovery for a cycle/epoch whose lock no longer matches (e.g. tiers changed after
  /// its first settle): the next settle locks it again, never below the weight already settled
  function resetLock(IUintComp comps, uint256 cycle) internal {
    LibData.set(comps, 0, uint32(cycle), "BALLOT_ELIGIBLE_WEIGHT", 0);
  }

  /// @notice the reporter is trusted, so bound it: the cycle/epoch's first settle locks its
  /// eligible weight and settled weight can't pass it, which keeps base payouts under the pool
  function boundByWeight(
    IUintComp comps,
    uint256 cycle,
    uint256 weight,
    uint256 eligible
  ) internal {
    require(eligible > 0, "Ballot: no eligible weight");
    uint256 locked = LibData.get(comps, 0, uint32(cycle), "BALLOT_ELIGIBLE_WEIGHT");
    if (locked == 0) LibData.set(comps, 0, uint32(cycle), "BALLOT_ELIGIBLE_WEIGHT", eligible);
    else require(eligible == locked, "Ballot: weight mismatch");

    uint256 settled = LibData.get(comps, 0, uint32(cycle), "BALLOT_CYCLE_WEIGHT") + weight;
    require(settled <= eligible, "Ballot: weight over eligible");
    LibData.set(comps, 0, uint32(cycle), "BALLOT_CYCLE_WEIGHT", settled);
  }

  /// @notice mints everything owed (ballots + milestone rewards) and zeroes the owed balances
  function claim(
    IUintComp comps,
    uint256 accID
  ) internal returns (uint256 ballots, uint256 golden, uint256 badges) {
    ballots = LibData.get(comps, accID, 0, "BALLOT_OWED");
    bool any = ballots > 0;
    if (any) {
      LibData.set(comps, accID, 0, "BALLOT_OWED", 0);
      mint(comps, accID, BALLOT_INDEX, ballots);
    }

    uint32[5] memory rewards = milestoneRewards();
    for (uint256 i; i < rewards.length; i++) {
      uint256 owed = LibData.get(comps, accID, rewards[i], "BALLOT_OWED");
      if (owed == 0) continue;
      any = true;
      LibData.set(comps, accID, rewards[i], "BALLOT_OWED", 0);
      mint(comps, accID, rewards[i], owed);
      if (rewards[i] == GOLDEN_BALLOT_INDEX) golden += owed;
      else badges += owed;
    }
    require(any, "Ballot: nothing to claim");
  }

  /// @dev an unregistered item would mint without its NOT_TRADABLE flag
  function mint(IUintComp comps, uint256 accID, uint32 index, uint256 amt) internal {
    require(LibItem.getByIndex(comps, index) != 0, "Ballot: item not registered");
    LibInventory.incFor(comps, accID, index, amt);
  }

  /// @notice streak as of cycle/epoch, extending the previous one's streak. one missed
  /// cycle/epoch may be bridged by grace (never used, or used >= graceRefill cycles/epochs ago)
  /// @dev incremental, so earlier bridges persist; only called in order (BALLOT_LAST_CYCLE)
  function calcStreak(
    IUintComp comps,
    uint256 accID,
    uint256 cycle,
    uint256 graceRefill
  ) internal returns (uint256) {
    uint256 prev = LibData.get(comps, accID, uint32(cycle - 1), "BALLOT_STREAK");
    if (prev > 0) return prev + 1;
    if (cycle < 3) return 1;

    uint256 prev2 = LibData.get(comps, accID, uint32(cycle - 2), "BALLOT_STREAK");
    if (prev2 == 0) return 1;
    uint256 graceCycle = LibData.get(comps, accID, 0, "BALLOT_GRACE_CYCLE");
    if (graceCycle != 0 && cycle < graceCycle + graceRefill) return 1;

    LibData.set(comps, accID, 0, "BALLOT_GRACE_CYCLE", cycle - 1);
    return prev2 + 1;
  }

  /// @notice tiered weight of yominet power in millionths of a Ballot: each band earns 1 Ballot
  /// per its divisor in INIT. power arrives in raw uinit (1 INIT = 1e6); caps must rise
  function calcWeight(uint32[8] memory t, uint256 power) internal pure returns (uint256 w) {
    uint256 lo;
    for (uint256 i; i < 4 && power > lo; i++) {
      uint256 hi = i < 3 ? uint256(t[i]) * 1e6 : power;
      w += ((power < hi ? power : hi) - lo) / t[3 + i];
      lo = hi;
    }
  }

  /// @notice ballots for a cycle/epoch: the voter's weight, cut to their pool share once all weight
  /// would pay more (so busy cycles/epochs pay exactly the pool), never under the floor from floorMin INIT
  function calcBase(
    uint32[8] memory r,
    uint32[8] memory t,
    uint256 power,
    uint256 weight,
    uint256 eligible
  ) internal pure returns (uint256 base) {
    uint256 atRate = weight / 1e6;
    uint256 atPool = (weight * uint256(r[0])) / eligible;
    base = atRate < atPool ? atRate : atPool;
    if (power >= uint256(t[7]) * 1e6 && base < r[2]) base = r[2];
  }

  /// @notice items a claim can mint besides ballots: badges I-IV and the golden ballot
  function milestoneRewards() internal pure returns (uint32[5] memory) {
    return [VOTER_BADGE_I_INDEX, 16, 17, 18, GOLDEN_BALLOT_INDEX];
  }

  /// @notice a golden ballot every goldenEvery cycles/epochs of streak; badges I-IV once per
  /// account ever at streaks 5/10/26/52
  function oweMilestones(
    IUintComp comps,
    uint256 accID,
    uint256 cycle,
    uint256 power,
    uint256 streak,
    uint32[8] memory r
  ) internal {
    if (r[3] > 0 && streak % r[3] == 0 && oweGolden(comps, cycle, power, r)) {
      LibData.inc(comps, accID, GOLDEN_BALLOT_INDEX, "BALLOT_OWED", 1);
    }

    uint256 best = LibData.get(comps, accID, 0, "BALLOT_STREAK_BEST");
    if (streak <= best) return;
    LibData.set(comps, accID, 0, "BALLOT_STREAK_BEST", streak);

    uint8[4] memory steps = [5, 10, 26, 52];
    for (uint256 i; i < steps.length && steps[i] <= streak; i++) {
      if (steps[i] <= best) continue;
      LibData.inc(comps, accID, VOTER_BADGE_I_INDEX + uint32(i), "BALLOT_OWED", 1);
    }
  }

  /// @notice golden ballots need goldenPower INIT on yominet and stay under the cycle/epoch's
  /// goldenCap; both are 0 (off) unless farming shows up
  function oweGolden(
    IUintComp comps,
    uint256 cycle,
    uint256 power,
    uint32[8] memory r
  ) internal returns (bool) {
    if (power < uint256(r[6]) * 1e6) return false;
    uint256 owed = LibData.get(comps, 0, uint32(cycle), "BALLOT_CYCLE_GOLDEN");
    if (r[7] > 0 && owed >= r[7]) return false;
    LibData.inc(comps, 0, uint32(cycle), "BALLOT_CYCLE_GOLDEN", 1);
    return true;
  }

  /////////////////
  // LOGGING

  function logSettle(
    IWorld world,
    uint256 accID,
    uint256 cycle,
    uint256 power,
    uint256 ballots,
    uint256 streak
  ) internal {
    uint8[] memory schema = new uint8[](5);
    schema[0] = uint8(LibTypes.SchemaValue.UINT256); // accID
    schema[1] = uint8(LibTypes.SchemaValue.UINT256); // cycle
    schema[2] = uint8(LibTypes.SchemaValue.UINT256); // power
    schema[3] = uint8(LibTypes.SchemaValue.UINT256); // ballots
    schema[4] = uint8(LibTypes.SchemaValue.UINT256); // streak
    LibEmitter.emitEvent(
      world,
      "BALLOT_SETTLE",
      schema,
      abi.encode(accID, cycle, power, ballots, streak)
    );
  }

  function logClaim(
    IWorld world,
    uint256 accID,
    uint256 ballots,
    uint256 golden,
    uint256 badges
  ) internal {
    uint8[] memory schema = new uint8[](4);
    schema[0] = uint8(LibTypes.SchemaValue.UINT256); // accID
    schema[1] = uint8(LibTypes.SchemaValue.UINT256); // ballots
    schema[2] = uint8(LibTypes.SchemaValue.UINT256); // golden ballots
    schema[3] = uint8(LibTypes.SchemaValue.UINT256); // badges
    LibEmitter.emitEvent(world, "BALLOT_CLAIM", schema, abi.encode(accID, ballots, golden, badges));
  }
}
