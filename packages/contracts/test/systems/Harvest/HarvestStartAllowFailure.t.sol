// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { Vm } from "forge-std/Vm.sol";
import { LibTax } from "libraries/LibTax.sol";
import "tests/utils/SetupTemplate.t.sol";

// Starts that skip a kami unable to start. Each case runs both entry points from the same
// state: the skipping one must start exactly the kamis the reverting one accepts.
contract HarvestStartAllowFailureTest is SetupTemplate {
  uint32 constant NODE = 1; // room 1, where accounts spawn
  uint32 constant GATED_NODE = 2; // room 1, given a level requirement below
  uint256 constant NOT_A_KAMI = 12345;

  uint256[] aKamiIDs;
  uint256 bKamiID;

  function setUp() public override {
    super.setUp();
    aKamiIDs = _mintKamis(alice, 6);
    bKamiID = _mintKami(bob);
  }

  /////////////////
  // SINGLE

  function testAllowFailureStartsLikeExecute() public {
    assertTrue(_assertParity(alice.operator, aKamiIDs[0], NODE, 0, 0), "untaxed start");
    assertTrue(_assertParity(alice.operator, aKamiIDs[1], NODE, bob.id, 600), "taxed start");

    for (uint256 i; i < 2; i++) {
      assertEq(LibKami.getState(components, aKamiIDs[i]), "HARVESTING");
      assertTrue(LibKami.onCooldown(components, aKamiIDs[i]));
    }
    uint256 taxedID = LibHarvest.getForKami(components, aKamiIDs[1]);
    assertEq(LibTax.getFor(components, taxedID).length, 1, "tax not set");
    assertEq(LibTax.getFor(components, LibHarvest.getForKami(components, aKamiIDs[0])).length, 0);
  }

  function testRevertsForMalformedArguments() public {
    vm.prank(alice.operator);
    vm.expectRevert("start reverted without reason");
    _HarvestStartSystem.executeAllowFailure(hex"1234");
  }

  function testSkipsOtherAccountsKami() public {
    _assertSkipped(alice.operator, bKamiID, NODE);
    assertEq(_lastLogCount, 0, "wrote for a kami it does not own");
  }

  // reading the owner of an id that is no kami fails without a reason, in both entry points
  function testRevertsForUnknownID() public {
    vm.prank(alice.operator);
    vm.expectRevert();
    _HarvestStartSystem.executeTyped(NOT_A_KAMI, NODE, 0, 0);

    vm.prank(alice.operator);
    vm.expectRevert("start reverted without reason");
    _HarvestStartSystem.executeAllowFailure(abi.encode(NOT_A_KAMI, NODE, 0, 0));
  }

  function testSkipsUnstakedKami() public {
    _unstakeKami(aKamiIDs[0]);
    _assertSkipped(alice.operator, aKamiIDs[0], NODE);
    assertEq(_lastLogCount, 0, "wrote for an unstaked kami");
  }

  function testSkipsHarvestingKami() public {
    _startHarvest(aKamiIDs[0], NODE);
    _fastForward(_idleRequirement);
    _assertSkipped(alice.operator, aKamiIDs[0], NODE);
    assertEq(_lastLogCount, 0, "wrote for a harvesting kami");
  }

  function testSkipsDeadKami() public {
    vm.startPrank(deployer);
    LibKami.setState(components, aKamiIDs[0], "DEAD");
    vm.stopPrank();
    _assertSkipped(alice.operator, aKamiIDs[0], NODE);
    assertEq(_lastLogCount, 0, "wrote for a dead kami");
  }

  function testSkipsKamiOnCooldown() public {
    _putOnCooldown(aKamiIDs[0]);
    _assertSkipped(alice.operator, aKamiIDs[0], NODE);

    // startable once the cooldown ends
    _fastForward(_idleRequirement);
    assertTrue(_assertParity(alice.operator, aKamiIDs[0], NODE, 0, 0));
  }

  function testSkipsStarvingKami() public {
    ExternalCaller.kamiSync(aKamiIDs[0]); // no recovery left to sync in this block
    vm.startPrank(deployer);
    LibKami.drain(components, aKamiIDs[0], 100000);
    vm.stopPrank();
    assertFalse(LibKami.isHealthy(components, aKamiIDs[0]));
    _assertSkipped(alice.operator, aKamiIDs[0], NODE);
  }

  function testSkipsWhenAccountNotAtNode() public {
    _moveAccount(alice, 2);
    _fastForward(1 hours); // a sync that stuck would move the kami's last timestamp
    _assertSkipped(alice.operator, aKamiIDs[0], NODE);
  }

  function testSkipsKamiFailingNodeRequirements() public {
    vm.prank(deployer);
    __NodeRegistrySystem.addRequirement(abi.encode(GATED_NODE, "LEVEL", "CURR_MIN", 0, 2, "KAMI"));

    _fastForward(1 hours); // a sync that stuck would move the kami's last timestamp
    _assertSkipped(alice.operator, aKamiIDs[0], GATED_NODE);

    _setLevel(aKamiIDs[1], 2);
    assertTrue(_assertParity(alice.operator, aKamiIDs[1], GATED_NODE, 0, 0));
  }

  function testSkipsForUnknownOperator() public {
    assertFalse(_assertParity(_getOperator(15), aKamiIDs[0], NODE, 0, 0)); // never registered
    assertEq(_lastLogCount, 0);
  }

  /////////////////
  // BATCHED

  function testBatchMatchesStrictBatch() public {
    uint256[] memory ids = aKamiIDs;
    uint256 snapshot = vm.snapshotState();

    vm.recordLogs();
    vm.prank(alice.operator);
    _HarvestStartSystem.executeBatched(ids, NODE, bob.id, 600);
    bytes32 strictLogs = _hashLogs(vm.getRecordedLogs());

    vm.revertToState(snapshot);
    vm.recordLogs();
    uint256[] memory results = _startBatch(alice, ids, NODE, bob.id, 600);
    assertEq(_hashLogs(vm.getRecordedLogs()), strictLogs, "write sequence mismatch");

    for (uint256 i; i < ids.length; i++) {
      assertEq(results[i], LibHarvest.getForKami(components, ids[i]), "harvest id mismatch");
      assertTrue(results[i] != 0);
      assertEq(LibKami.getState(components, ids[i]), "HARVESTING");
      assertEq(LibTax.getFor(components, results[i]).length, 1, "tax not set");
    }
  }

  function testBatchSkipsFailingKamis() public {
    _startHarvest(aKamiIDs[1], NODE);
    _putOnCooldown(aKamiIDs[2]);

    uint256[] memory ids = new uint256[](6);
    ids[0] = aKamiIDs[0];
    ids[1] = aKamiIDs[1]; // harvesting
    ids[2] = aKamiIDs[2]; // on cooldown
    ids[3] = bKamiID; // another account's
    ids[4] = aKamiIDs[3];
    ids[5] = aKamiIDs[0]; // duplicate of the first

    // the reverting batch rejects the whole list
    vm.prank(alice.operator);
    vm.expectRevert();
    _HarvestStartSystem.executeBatched(ids, NODE, 0, 0);

    // the skipping batch writes exactly what starting the two startable kamis writes
    uint256[] memory startable = new uint256[](2);
    startable[0] = aKamiIDs[0];
    startable[1] = aKamiIDs[3];
    uint256 snapshot = vm.snapshotState();
    vm.recordLogs();
    vm.prank(alice.operator);
    _HarvestStartSystem.executeBatched(startable, NODE, 0, 0);
    bytes32 strictLogs = _hashLogs(vm.getRecordedLogs());

    vm.revertToState(snapshot);
    vm.recordLogs();
    uint256[] memory results = _startBatch(alice, ids, NODE, 0, 0);
    assertEq(_hashLogs(vm.getRecordedLogs()), strictLogs, "a skipped entry left writes");

    assertEq(results.length, 6);
    assertEq(results[0], LibHarvest.getForKami(components, aKamiIDs[0]));
    assertEq(results[4], LibHarvest.getForKami(components, aKamiIDs[3]));
    assertTrue(results[0] != 0 && results[4] != 0, "startable kamis skipped");
    assertEq(results[1] | results[2] | results[3] | results[5], 0, "started a failing entry");

    assertEq(LibKami.getState(components, aKamiIDs[0]), "HARVESTING");
    assertEq(LibKami.getState(components, aKamiIDs[3]), "HARVESTING");
    assertEq(LibKami.getState(components, aKamiIDs[2]), "RESTING");
    assertEq(LibKami.getState(components, bKamiID), "RESTING");
    assertEq(
      LibHarvest.getForKami(components, bKamiID),
      0,
      "created a harvest for another account"
    );

    // the skipped kami starts in a later batch
    _fastForward(_idleRequirement);
    uint256[] memory retry = new uint256[](1);
    retry[0] = aKamiIDs[2];
    assertTrue(_startBatch(alice, retry, NODE, 0, 0)[0] != 0, "skipped kami did not start later");
  }

  // a tax over the cap fails each start on its own: nothing starts, nothing stays written
  function testBatchTaxOverCapStartsNothing() public {
    uint256[] memory ids = aKamiIDs;
    _fastForward(1 hours);
    uint256 lastTs = LibKami.getLastTs(components, ids[0]);

    uint256[] memory results = _startBatch(alice, ids, NODE, bob.id, 2001);
    for (uint256 i; i < ids.length; i++) {
      assertEq(results[i], 0);
      assertEq(LibKami.getState(components, ids[i]), "RESTING");
      assertEq(LibKami.getLastTs(components, ids[i]), lastTs, "sync stuck");
      assertEq(LibHarvest.getForKami(components, ids[i]), 0, "harvest created");
      assertFalse(LibKami.onCooldown(components, ids[i]));
    }
  }

  function testEmptyBatch() public {
    assertEq(_startBatch(alice, new uint256[](0), NODE, 0, 0).length, 0);
  }

  /////////////////
  // BATCH-WIDE REVERTS

  function testBatchRevertsForUnknownOperator() public {
    uint256[] memory ids = aKamiIDs;
    vm.prank(_getOperator(15)); // never registered
    vm.expectRevert("Account: Operator not found");
    _HarvestStartSystem.executeBatchedAllowFailure(ids, NODE, 0, 0);
  }

  function testBatchRevertsForMissingNode() public {
    uint256[] memory ids = aKamiIDs;
    vm.prank(alice.operator);
    vm.expectRevert("node does not exist");
    _HarvestStartSystem.executeBatchedAllowFailure(ids, 99, 0, 0);
  }

  function testBatchRevertsForUnknownID() public {
    uint256[] memory ids = new uint256[](2);
    ids[0] = aKamiIDs[0];
    ids[1] = NOT_A_KAMI;
    vm.prank(alice.operator);
    vm.expectRevert("start reverted without reason");
    _HarvestStartSystem.executeBatchedAllowFailure(ids, NODE, 0, 0);
  }

  function testBatchRevertsWhenAccountNotAtNode() public {
    _moveAccount(alice, 2);
    uint256[] memory ids = aKamiIDs;
    vm.prank(alice.operator);
    vm.expectRevert("not in same room");
    _HarvestStartSystem.executeBatchedAllowFailure(ids, NODE, 0, 0);
  }

  /////////////////
  // GAS

  function testRevertsWhenAStartRunsOutOfGas() public {
    uint256[] memory ids = aKamiIDs;
    vm.prank(alice.operator);
    vm.expectRevert("start reverted without reason");
    _HarvestStartSystem.executeBatchedAllowFailure{ gas: 1_000_000 }(ids, NODE, 0, 0);
  }

  // At any gas limit the batch reverts or starts every startable kami: a start cut short by
  // the limit is never reported as a skipped kami, so a gas estimate cannot settle too low.
  function testNoSilentSkipAtAnyGasLimit() public {
    _putOnCooldown(aKamiIDs[1]);
    uint256[] memory ids = new uint256[](3);
    ids[0] = aKamiIDs[0];
    ids[1] = aKamiIDs[1]; // on cooldown, skipped at any limit
    ids[2] = aKamiIDs[2];
    uint256 snapshot = vm.snapshotState();

    vm.prank(alice.operator);
    uint256 gasStart = gasleft();
    _HarvestStartSystem.executeBatchedAllowFailure(ids, NODE, 0, 0);
    uint256 needed = gasStart - gasleft();

    uint256 passed;
    uint256 reverted;
    for (uint256 limit = needed / 50; limit <= (needed * 21) / 20; limit += needed / 500) {
      vm.revertToState(snapshot);
      vm.prank(alice.operator);
      try _HarvestStartSystem.executeBatchedAllowFailure{ gas: limit }(ids, NODE, 0, 0) returns (
        bytes[] memory raw
      ) {
        passed++;
        assertTrue(abi.decode(raw[0], (uint256)) != 0, "startable kami skipped for gas");
        assertEq(abi.decode(raw[1], (uint256)), 0);
        assertTrue(abi.decode(raw[2], (uint256)) != 0, "startable kami skipped for gas");
      } catch {
        reverted++;
      }
    }
    assertTrue(passed > 0 && reverted > 0, "sweep did not cross the gas boundary");
  }

  /////////////////
  // UTILS

  // logs emitted by the last skipping call in _assertParity, undone inner calls included
  uint256 _lastLogCount;

  // Runs the reverting and the skipping start from one state. They must agree on the outcome
  // and, when the kami starts, emit the same component writes. Leaves the skipping run applied.
  function _assertParity(
    address operator,
    uint256 kamiID,
    uint32 nodeIndex,
    uint256 taxerID,
    uint256 taxAmt
  ) internal returns (bool started) {
    uint256 snapshot = vm.snapshotState();
    uint256 strictID;

    vm.recordLogs();
    vm.prank(operator);
    try _HarvestStartSystem.executeTyped(kamiID, nodeIndex, taxerID, taxAmt) returns (
      bytes memory result
    ) {
      started = true;
      strictID = abi.decode(result, (uint256));
    } catch {}
    bytes32 strictLogs = _hashLogs(vm.getRecordedLogs());

    vm.revertToState(snapshot);
    vm.recordLogs();
    vm.prank(operator);
    uint256 softID = abi.decode(
      _HarvestStartSystem.executeAllowFailure(abi.encode(kamiID, nodeIndex, taxerID, taxAmt)),
      (uint256)
    );
    Vm.Log[] memory softLogs = vm.getRecordedLogs();
    _lastLogCount = softLogs.length;

    assertEq(softID != 0, started, "outcome mismatch");
    if (started) {
      assertEq(softID, strictID, "harvest id mismatch");
      assertEq(_hashLogs(softLogs), strictLogs, "write sequence mismatch");
    }
  }

  // a skipped kami is left as it was, including the sync a start runs before its checks
  function _assertSkipped(address operator, uint256 kamiID, uint32 nodeIndex) internal {
    string memory state = LibKami.getState(components, kamiID);
    uint256 harvestID = LibHarvest.getForKami(components, kamiID);
    uint256 lastTs = LibKami.getLastTs(components, kamiID);
    uint256 cooldownEnd = LibCooldown.getEnd(components, kamiID);
    int32 health = LibStat.get(components, "HEALTH", kamiID).sync;

    assertFalse(_assertParity(operator, kamiID, nodeIndex, 0, 0), "execute accepted the kami");

    assertEq(LibKami.getState(components, kamiID), state, "state changed");
    assertEq(LibHarvest.getForKami(components, kamiID), harvestID, "harvest created");
    assertEq(LibKami.getLastTs(components, kamiID), lastTs, "sync stuck");
    assertEq(LibCooldown.getEnd(components, kamiID), cooldownEnd, "cooldown changed");
    assertEq(LibStat.get(components, "HEALTH", kamiID).sync, health, "health changed");
  }

  function _startBatch(
    PlayerAccount memory acc,
    uint256[] memory ids,
    uint32 nodeIndex,
    uint256 taxerID,
    uint256 taxAmt
  ) internal returns (uint256[] memory results) {
    vm.prank(acc.operator);
    bytes[] memory raw = _HarvestStartSystem.executeBatchedAllowFailure(
      ids,
      nodeIndex,
      taxerID,
      taxAmt
    );
    results = new uint256[](raw.length);
    for (uint256 i; i < raw.length; i++) results[i] = abi.decode(raw[i], (uint256));
  }

  // leaves the kami resting with an active cooldown
  function _putOnCooldown(uint256 kamiID) internal {
    uint256 harvestID = _startHarvest(kamiID, NODE);
    _fastForward(_idleRequirement);
    _stopHarvest(harvestID);
  }

  function _hashLogs(Vm.Log[] memory logs) internal pure returns (bytes32 hash) {
    for (uint256 i; i < logs.length; i++) {
      hash = keccak256(abi.encode(hash, logs[i].emitter, logs[i].topics, logs[i].data));
    }
  }
}
