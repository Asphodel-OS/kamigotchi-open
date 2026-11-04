// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import "tests/utils/SetupTemplate.t.sol";
import { LibBallot, BALLOT_INDEX, GOLDEN_BALLOT_INDEX } from "libraries/LibBallot.sol";

contract BallotTest is SetupTemplate {
  address reporter = address(0x1BC);
  uint256 constant POWER = 1_500_000e6; // raw uinit, as L1 reports
  uint256 constant ELIGIBLE = 10_000e6; // alice's weight, 1 Ballot per 150 INIT, in millionths
  uint256 constant BASE = 10000; // alice is the only voter, under the pool
  uint32 constant VIPP_INDEX = 2;
  uint32 constant BADGE_I = 15;
  uint256 constant START = 1_000_000;

  uint32[8] PROD_RATES = [uint32(10000), 13, 1, 5, 7500, 100, 0, 0];
  uint32[8] PROD_TIERS = [uint32(5000), 50000, 150000, 30, 60, 90, 120, 10];

  function setUp() public override {
    super.setUp();
    _setConfig("BALLOT_REPORTER", reporter);
    _setConfig("BALLOT_RATES", [uint32(10000), 13, 1, 10, 0, 0, 0, 0]);
    // one flat band: 1 Ballot per 150 INIT
    _setConfig("BALLOT_TIERS", [uint32(4e9), 4e9, 4e9, 150, 150, 150, 150, 1]);
    // cycles/epochs from 1 settle; time starts in cycle/epoch 2, and _settle moves it to just
    // after each settled cycle/epoch closes (settles are limited to recent ones)
    _setConfig("BALLOT_CYCLE", [uint32(START), 1209600, 1, 0, 0, 0, 0, 0]);
    _setTime(START + 1209600);
  }

  function setUpItems() public override {
    for (uint32 i = BALLOT_INDEX; i <= 18; i++) _createGenericItem(i);
    _createGenericItem(VIPP_INDEX);
  }

  /////////////////
  // HELPERS

  function _settle(uint256 cycle, uint256 power, uint256 eligible, bool streakVote) internal {
    _settleAs(alice.owner, cycle, power, eligible, streakVote);
  }

  function _settleAs(
    address owner,
    uint256 cycle,
    uint256 power,
    uint256 eligible,
    bool streakVote
  ) internal {
    _closeCycle(cycle);
    vm.prank(reporter);
    _BallotSettleSystem.executeTyped(owner, uint64(cycle), power, eligible, streakVote);
  }

  /// @dev moves time to the start of the next cycle/epoch, so `cycle` has just closed
  function _closeCycle(uint256 cycle) internal {
    uint32[8] memory c = LibConfig.getArray(components, "BALLOT_CYCLE");
    _setTime(uint256(c[0]) + (cycle + 1 - c[2]) * c[1]);
  }

  /// @dev a streak vote (yominet share at or above the threshold)
  function _settle(uint256 cycle) internal {
    _settle(cycle, POWER, ELIGIBLE, true);
  }

  function _ballots() internal view returns (uint256) {
    return _getItemBal(alice, BALLOT_INDEX);
  }

  function _owed() internal view returns (uint256) {
    return LibData.get(components, alice.id, 0, "BALLOT_OWED");
  }

  function _claim() internal {
    vm.prank(alice.operator);
    _BallotClaimSystem.executeTyped();
  }

  /// @dev settle then claim, for the settle-math tests
  function _settleClaim(uint256 cycle, uint256 power, uint256 eligible, bool streakVote) internal {
    _settle(cycle, power, eligible, streakVote);
    _claim();
  }

  function _settleClaim(uint256 cycle) internal {
    _settleClaim(cycle, POWER, ELIGIBLE, true);
  }

  function _streak(uint256 cycle) internal view returns (uint256) {
    return LibData.get(components, alice.id, uint32(cycle), "BALLOT_STREAK");
  }

  /////////////////
  // SETTLE

  function testSettleSenderCheck() public {
    vm.prank(alice.operator);
    vm.expectRevert("Ballot: not reporter");
    _BallotSettleSystem.executeTyped(alice.owner, 1, POWER, ELIGIBLE, true);

    vm.prank(reporter);
    vm.expectRevert("Account: no account detected");
    _BallotSettleSystem.executeTyped(address(0xdead), 1, POWER, ELIGIBLE, true);

    vm.prank(reporter);
    vm.expectRevert("Ballot: no yominet power");
    _BallotSettleSystem.executeTyped(alice.owner, 1, 0, ELIGIBLE, true);

    vm.prank(reporter);
    vm.expectRevert("Ballot: no eligible weight");
    _BallotSettleSystem.executeTyped(alice.owner, 1, POWER, 0, true);
  }

  function testSettleWeightOverEligibleReverts() public {
    vm.prank(reporter);
    vm.expectRevert("Ballot: weight over eligible");
    _BallotSettleSystem.executeTyped(alice.owner, 1, POWER + 150e6, ELIGIBLE, true);
  }

  function testSettleCycleWindow() public {
    vm.prank(reporter);
    vm.expectRevert("Ballot: cycle still open");
    _BallotSettleSystem.executeTyped(alice.owner, 100, POWER, ELIGIBLE, true);

    vm.prank(reporter);
    vm.expectRevert("Ballot: cycle before launch");
    _BallotSettleSystem.executeTyped(alice.owner, 0, POWER, ELIGIBLE, true);

    // launch at 150: the same clock now reads cycle/epoch 249
    _setConfig("BALLOT_CYCLE", [uint32(START), 1209600, 150, 0, 0, 0, 0, 0]);
    vm.prank(reporter);
    vm.expectRevert("Ballot: cycle before launch");
    _BallotSettleSystem.executeTyped(alice.owner, 149, POWER, ELIGIBLE, true);
    _settle(150);

    // a cycle/epoch settles once the next one starts (after 150 here: paid, no streak)
    _setConfig("BALLOT_CYCLE", [uint32(START), 1209600, 1, 0, 0, 0, 0, 0]);
    _fastForward(1209600);
    _settle(100);
    assertEq(LibData.get(components, alice.id, 100, "BALLOT_SETTLED"), 1);
    assertEq(_streak(100), 0);
  }

  function testSettleWeightLock() public {
    _settle(1); // locks ELIGIBLE for cycle/epoch 1
    assertEq(LibData.get(components, 0, 1, "BALLOT_ELIGIBLE_WEIGHT"), ELIGIBLE);
    vm.prank(reporter);
    vm.expectRevert("Ballot: weight mismatch");
    _BallotSettleSystem.executeTyped(bob.owner, 1, 1e6, ELIGIBLE * 2, true);
  }

  /// the settled weight of a cycle/epoch never passes the eligible weight, so base payouts stay
  /// under the pool
  function testSettleWeightBoundedAcrossVoters() public {
    vm.prank(reporter);
    _BallotSettleSystem.executeTyped(alice.owner, 1, POWER / 2, ELIGIBLE, true);
    vm.prank(reporter);
    vm.expectRevert("Ballot: weight over eligible");
    _BallotSettleSystem.executeTyped(bob.owner, 1, POWER / 2 + 150e6, ELIGIBLE, true);

    vm.prank(reporter);
    _BallotSettleSystem.executeTyped(bob.owner, 1, POWER / 2, ELIGIBLE, true);
    assertEq(LibData.get(components, 0, 1, "BALLOT_CYCLE_WEIGHT"), ELIGIBLE);
    assertEq(LibData.get(components, 0, 1, "BALLOT_VOTERS"), 2);
  }

  function testSettleTierWeights() public view {
    // micro-Ballots: 1 per 30 INIT to 5k, 60 to 50k, 90 to 150k, then 120
    assertEq(LibBallot.calcWeight(PROD_TIERS, 1e6), 33_333);
    assertEq(LibBallot.calcWeight(PROD_TIERS, 5_000e6), 166_666_666);
    assertEq(LibBallot.calcWeight(PROD_TIERS, 50_000e6), 166_666_666 + 750e6);
    assertEq(LibBallot.calcWeight(PROD_TIERS, 100_000e6), 166_666_666 + 750e6 + 555_555_555);
    assertEq(LibBallot.calcWeight(PROD_TIERS, 150_000e6), 166_666_666 + 750e6 + 1_111_111_111);
    assertEq(LibBallot.calcWeight(PROD_TIERS, 367653402908), 3_841_556_134);
  }

  /// cycle/epoch 38 on mainnet: 0xd5e8…0ae4 voted 367,653 INIT, all on Yominet; its 27 wallet
  /// voters sum to 18,547,294,868 micro-Ballots at the prod tiers, so the pool of 10,000 splits
  function testSettleRealCycle38() public {
    _setConfig("BALLOT_RATES", PROD_RATES);
    _setConfig("BALLOT_TIERS", PROD_TIERS);
    _settleClaim(38, 367653402908, 18547294868, true);
    assertEq(_ballots(), 2071); // weight 3,841.6, pool share 2,071.2
  }

  function testSettleSplitVotePaysBase() public {
    _setConfig("BALLOT_RATES", PROD_RATES);
    _setConfig("BALLOT_TIERS", PROD_TIERS);
    _settleClaim(1, 100_000e6, 1_472_222_221, false); // alone: capped by the rate
    assertEq(_ballots(), 1472);
    assertEq(_streak(1), 0);

    vm.prank(reporter);
    vm.expectRevert("Ballot: cycle already settled");
    _BallotSettleSystem.executeTyped(alice.owner, 1, 100_000e6, 1_472_222_221, false);
  }

  function testSettleFloor() public {
    _setConfig("BALLOT_RATES", PROD_RATES);
    _setConfig("BALLOT_TIERS", PROD_TIERS);
    _settle(1, 10e6, 1e6, false); // 10 INIT: weight 0.33, floored to 1
    assertEq(_owed(), 1);
    _settle(2, 5e6, 1e6, false); // 5 INIT: under the floor's minimum, nothing owed
    assertEq(_owed(), 1);
    assertEq(LibData.get(components, alice.id, 2, "BALLOT_SETTLED"), 1);
  }

  function testSettlePoolScales() public {
    _settleClaim(1); // under the pool
    assertEq(_ballots(), BASE);

    // over the pool: alice holds a third of the eligible weight
    _decItem(alice, BALLOT_INDEX, BASE);
    _settleClaim(10, POWER, ELIGIBLE * 3, false);
    assertEq(_ballots(), BASE / 3);
    assertEq(LibData.get(components, 0, 10, "BALLOT_VOTERS"), 1);
  }

  function testSettleDoubleRevert() public {
    _settleClaim(1);
    vm.prank(reporter);
    vm.expectRevert("Ballot: cycle already settled");
    _BallotSettleSystem.executeTyped(alice.owner, 1, POWER, ELIGIBLE, true);
    assertEq(_streak(1), 1);
    assertEq(_ballots(), BASE);
  }

  /// a vote under the streak threshold pays its base but counts as a missed cycle/epoch, which grace can bridge
  function testSettleSplitVoteIsAMiss() public {
    _settle(1);
    _settle(2);
    _settle(3, POWER, ELIGIBLE, false);
    assertEq(_streak(3), 0);
    _settle(4);
    assertEq(_streak(4), 3);
    assertEq(LibData.get(components, alice.id, 0, "BALLOT_GRACE_CYCLE"), 3);
  }

  /// the streak pays items only: ballots stay the same every cycle/epoch
  function testSettleStreakGrowthAndMilestones() public {
    for (uint256 c = 1; c <= 52; c++) {
      _settleClaim(c);
      assertEq(_streak(c), c);
      assertEq(_ballots(), c * BASE);
    }
    // badges I-IV once each, a golden ballot every 10 cycles/epochs
    for (uint32 i = BADGE_I; i <= 18; i++) assertEq(_getItemBal(alice, i), 1);
    assertEq(_getItemBal(alice, GOLDEN_BALLOT_INDEX), 5);
    assertEq(_getItemBal(alice, VIPP_INDEX), 0);
  }

  function testSettleBadgesOnceAfterReset() public {
    for (uint256 c = 1; c <= 5; c++) _settleClaim(c); // badge I
    for (uint256 c = 8; c <= 12; c++) _settleClaim(c); // 6 and 7 missed: streak 1 to 5 again
    assertEq(_streak(12), 5);
    assertEq(_getItemBal(alice, BADGE_I), 1);
    assertEq(LibData.get(components, alice.id, 0, "BALLOT_STREAK_BEST"), 5);
  }

  function testSettleGoldenRecursAfterReset() public {
    for (uint256 c = 1; c <= 10; c++) _settleClaim(c);
    assertEq(_getItemBal(alice, GOLDEN_BALLOT_INDEX), 1);
    for (uint256 c = 13; c <= 22; c++) _settleClaim(c); // 11 and 12 missed: a new streak of 10
    assertEq(_streak(22), 10);
    assertEq(_getItemBal(alice, GOLDEN_BALLOT_INDEX), 2);
    assertEq(_getItemBal(alice, BADGE_I + 1), 1); // badge II stays once
  }

  function testSettleGraceBridgeAndRefill() public {
    _settleClaim(1);
    _settleClaim(2);
    _settleClaim(4); // 3 missed, bridged by grace
    assertEq(_streak(4), 3);
    assertEq(LibData.get(components, alice.id, 0, "BALLOT_GRACE_CYCLE"), 3);

    _settleClaim(6); // 5 missed, grace not refilled (3 + 13 > 6)
    assertEq(_streak(6), 1);

    for (uint256 c = 7; c <= 15; c++) _settleClaim(c);
    assertEq(_streak(15), 10);
    _settleClaim(17); // 16 missed, 16 >= 3 + 13: refilled
    assertEq(_streak(17), 11);
    assertEq(LibData.get(components, alice.id, 0, "BALLOT_GRACE_CYCLE"), 16);
  }

  /// dust can't farm golden ballots: under the streak power a vote pays its ballots, no streak
  function testSettleStreakNeedsPower() public {
    _setConfig("BALLOT_RATES", [uint32(10000), 13, 1, 10, 7500, 100, 0, 0]);
    _settle(1, 99e6, ELIGIBLE, true);
    assertEq(_streak(1), 0);
    assertEq(_owed(), 1); // the floor
    _settle(2, 100e6, ELIGIBLE, true);
    assertEq(_streak(2), 1);
  }

  /// floors are paid on top of the pool split, until the pool is spent
  function testSettleFloorCappedByPool() public {
    _setConfig("BALLOT_RATES", [uint32(2), 13, 1, 10, 0, 0, 0, 0]);
    address[3] memory owners = [alice.owner, bob.owner, charlie.owner];
    for (uint256 i; i < owners.length; i++) {
      vm.prank(reporter);
      _BallotSettleSystem.executeTyped(owners[i], 1, 10e6, ELIGIBLE, false);
    }
    assertEq(LibData.get(components, 0, 1, "BALLOT_CYCLE_MINTED"), 2);
    assertEq(LibData.get(components, charlie.id, 0, "BALLOT_OWED"), 0);
  }

  /// a cycle/epoch settled after a later one pays its ballots but no streak, so nothing is
  /// owed twice
  function testSettleOutOfOrderSkipsStreak() public {
    for (uint256 c = 1; c <= 9; c++) _settle(c);
    _settle(11); // 10 not settled yet: grace bridges it, streak 10, golden ballot owed
    assertEq(_streak(11), 10);
    _settle(10); // late: paid, no streak
    assertEq(_streak(10), 0);
    assertEq(LibData.get(components, alice.id, GOLDEN_BALLOT_INDEX, "BALLOT_OWED"), 1);
    assertEq(_owed(), 11 * BASE);
  }

  /// unset rates or tiers would settle the cycle/epoch for nothing
  function testSettleNeedsConfig() public {
    _setConfig("BALLOT_RATES", [uint32(0), 13, 1, 10, 0, 0, 0, 0]);
    vm.prank(reporter);
    vm.expectRevert("Ballot: rates not configured");
    _BallotSettleSystem.executeTyped(alice.owner, 1, POWER, ELIGIBLE, true);

    _setConfig("BALLOT_RATES", PROD_RATES);
    _setConfig("BALLOT_TIERS", [uint32(5000), 50000, 150000, 30, 60, 90, 0, 10]);
    vm.prank(reporter);
    vm.expectRevert("Ballot: tiers not configured");
    _BallotSettleSystem.executeTyped(alice.owner, 1, POWER, ELIGIBLE, true);
  }

  /// the owner can clear a cycle/epoch's lock; the next settle locks it again, never below the
  /// weight already settled
  function testResetLock() public {
    _settle(1); // locks ELIGIBLE and settles all of it
    vm.prank(reporter);
    vm.expectRevert(); // owner only
    _BallotSettleSystem.resetLock(1);

    vm.prank(deployer);
    _BallotSettleSystem.resetLock(1);
    assertEq(LibData.get(components, 0, 1, "BALLOT_ELIGIBLE_WEIGHT"), 0);

    vm.prank(reporter);
    vm.expectRevert("Ballot: weight over eligible");
    _BallotSettleSystem.executeTyped(bob.owner, 1, 150e6, ELIGIBLE, true);
    vm.prank(reporter);
    _BallotSettleSystem.executeTyped(bob.owner, 1, 150e6, ELIGIBLE + 1e6, true);
    assertEq(LibData.get(components, 0, 1, "BALLOT_ELIGIBLE_WEIGHT"), ELIGIBLE + 1e6);
  }

  /// each settle records its power, so the job can check it against L1
  function testSettleRecordsPower() public {
    _settle(1);
    assertEq(LibData.get(components, alice.id, 1, "BALLOT_POWER"), POWER);
  }

  /// only cycles/epochs within SETTLE_WINDOW of the current one settle
  function testSettleWindow() public {
    _setTime(START + 20 * 1209600); // cycle/epoch 21
    vm.prank(reporter);
    vm.expectRevert("Ballot: cycle too old");
    _BallotSettleSystem.executeTyped(alice.owner, 13, POWER, ELIGIBLE, true);
    vm.prank(reporter);
    _BallotSettleSystem.executeTyped(alice.owner, 14, POWER, ELIGIBLE, true);
    assertEq(LibData.get(components, alice.id, 14, "BALLOT_SETTLED"), 1);
  }

  /// golden ballots: a power minimum and a per cycle/epoch cap, both off by default
  function testGoldenLevers() public {
    _setConfig("BALLOT_RATES", [uint32(10000), 13, 1, 5, 0, 0, 1000, 1]);
    for (uint256 c = 1; c <= 5; c++) {
      _settleAs(alice.owner, c, POWER, ELIGIBLE * 3, true);
      _settleAs(bob.owner, c, POWER, ELIGIBLE * 3, true); // over the cap of 1
      _settleAs(charlie.owner, c, 999e6, ELIGIBLE * 3, true); // under 1,000 INIT
    }
    assertEq(LibData.get(components, alice.id, GOLDEN_BALLOT_INDEX, "BALLOT_OWED"), 1);
    assertEq(LibData.get(components, bob.id, GOLDEN_BALLOT_INDEX, "BALLOT_OWED"), 0);
    assertEq(LibData.get(components, charlie.id, GOLDEN_BALLOT_INDEX, "BALLOT_OWED"), 0);
    assertEq(LibData.get(components, 0, 5, "BALLOT_CYCLE_GOLDEN"), 1);
    // the streak and badges don't depend on the levers
    assertEq(LibData.get(components, charlie.id, 5, "BALLOT_STREAK"), 5);
    assertEq(LibData.get(components, charlie.id, BADGE_I, "BALLOT_OWED"), 1);
  }

  /////////////////
  // CLAIM

  function testSettleDoesNotMint() public {
    for (uint256 c = 1; c <= 5; c++) _settle(c);
    assertEq(_ballots(), 0);
    assertEq(_getItemBal(alice, BADGE_I), 0);
    assertEq(_owed(), 5 * BASE);
    assertEq(LibData.get(components, alice.id, BADGE_I, "BALLOT_OWED"), 1);
  }

  function testClaimMintsOwed() public {
    _settle(1);
    uint256 owed = _owed();
    assertEq(owed, BASE);
    _claim();
    assertEq(_ballots(), owed);
    assertEq(_owed(), 0);
    assertEq(LibData.get(components, alice.id, BALLOT_INDEX, "ITEM_TOTAL"), owed);
  }

  function testOwnerClaims() public {
    _settle(1);
    vm.prank(alice.owner);
    _BallotClaimSystem.executeTyped();
    assertEq(_ballots(), BASE);
  }

  function testClaimDoubleReverts() public {
    vm.prank(alice.operator);
    vm.expectRevert("Ballot: nothing to claim");
    _BallotClaimSystem.executeTyped();

    _settle(1);
    _claim();
    vm.prank(alice.operator);
    vm.expectRevert("Ballot: nothing to claim");
    _BallotClaimSystem.executeTyped();
    assertEq(_ballots(), BASE);
  }

  function testClaimAccumulatesAcrossCycles() public {
    _settle(1);
    _settle(5); // no streak, no milestone
    assertEq(_owed(), 2 * BASE);
    _claim();
    assertEq(_ballots(), 2 * BASE);
  }

  function testClaimMilestonesOnce() public {
    for (uint256 c = 1; c <= 5; c++) _settle(c); // badge I owed
    _claim();
    assertEq(_getItemBal(alice, BADGE_I), 1);
    assertEq(LibData.get(components, alice.id, BADGE_I, "BALLOT_OWED"), 0);

    for (uint256 c = 8; c <= 12; c++) _settle(c); // streak 5 again: nothing new owed
    _claim();
    assertEq(_getItemBal(alice, BADGE_I), 1);
  }

  /// with the deploy's NOT_TRADABLE flag, claimed ballots can't leave the account
  function testClaimedBallotsAreSoulbound() public {
    _setFlag(LibItem.genID(BALLOT_INDEX), "NOT_TRADABLE", true);
    _settleClaim(1);
    uint32[] memory indices = new uint32[](1);
    indices[0] = BALLOT_INDEX;
    uint256[] memory amts = new uint256[](1);
    amts[0] = 1;
    vm.prank(alice.operator);
    vm.expectRevert("Transfer includes untradeable item");
    _ItemTransferSystem.executeTyped(indices, amts, bob.id);
  }

  /// minting an unregistered item would skip its NOT_TRADABLE flag, so claims wait for it
  function testClaimNeedsRegisteredItems() public {
    _settle(1);
    vm.prank(deployer);
    _IndexItemComponent.remove(LibItem.genID(BALLOT_INDEX));
    vm.prank(alice.operator);
    vm.expectRevert("Ballot: item not registered");
    _BallotClaimSystem.executeTyped();
  }
}
