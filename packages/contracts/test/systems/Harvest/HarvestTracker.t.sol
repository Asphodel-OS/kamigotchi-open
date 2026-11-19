// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import "tests/utils/SetupTemplate.t.sol";

// this test experience gain, leveling and all expected effects due to leveling
contract HarvestTrackerTest is SetupTemplate {
  uint256 aKamiID;

  function setUp() public override {
    super.setUp();

    aKamiID = _mintKami(alice);
  }

  function testTrackHarvestTime() public {
    // vm.getBlockTimestamp(), not block.timestamp: a compiler may read block.timestamp once per
    // call, which ignores the vm.warp calls below
    uint256 startTime = vm.getBlockTimestamp();
    uint32 nodeIndex = 1;

    uint256 prodID = _startHarvest(aKamiID, nodeIndex);
    _fastForward(_idleRequirement + 50);

    // feed pet
    _feedKami(alice, aKamiID);
    _fastForward(_idleRequirement + 50);

    // // collect harvest - does not inc time
    _collectHarvest(prodID);
    assertEq(0, LibData.get(components, alice.id, 0, "HARVEST_TIME"));

    // // stop harvest - logs time
    _fastForward(_idleRequirement + 50);
    _stopHarvest(prodID);
    assertEq(
      vm.getBlockTimestamp() - startTime,
      LibData.get(components, alice.id, 0, "HARVEST_TIME")
    );
  }
}
