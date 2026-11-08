// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import "tests/utils/SetupTemplate.t.sol";

contract HarvestAdminTest is SetupTemplate {
  uint256 aKamiID;

  function setUp() public override {
    super.setUp();

    aKamiID = _mintKami(alice);
  }

  /// @notice an admin stop pays the owner what the harvest earned, like a player stop
  function testHarvestAdminStopPaysOwner() public {
    uint256 prodID = _startHarvest(aKamiID, 1);
    _fastForward(_idleRequirement + 15 minutes);
    uint256 expected = LibHarvest.calcBounty(components, prodID);
    assertGt(expected, 0, "nothing harvested");

    uint256 xpBefore = LibExperience.get(components, aKamiID);
    uint32 kamiIndex = LibKami.getIndex(components, aKamiID); // before the prank: it reads a component
    vm.prank(deployer);
    __HarvestAdminSystem.stop(kamiIndex);

    assertEq(_getItemBal(alice, MUSU_INDEX), expected, "owner not paid");
    assertEq(LibExperience.get(components, aKamiID), xpBefore + expected, "xp not granted");
    assertEq(LibHarvest.getBalance(components, prodID), 0, "harvest balance not cleared");
    assertEq(LibKami.getState(components, aKamiID), "RESTING", "kami not resting");
  }

  /// @notice the admin stop pays a balance synced but not yet claimed, plus the window after it
  function testHarvestAdminStopPaysSyncedBalance() public {
    uint256 prodID = _startHarvest(aKamiID, 1);
    _fastForward(_idleRequirement + 15 minutes);
    ExternalCaller.kamiSync(aKamiID); // credits the first window to the harvest, unclaimed
    uint256 expected = LibHarvest.getBalance(components, prodID);
    assertGt(expected, 0, "nothing synced");
    _fastForward(_idleRequirement + 15 minutes);
    expected += LibHarvest.calcBounty(components, prodID);

    uint32[] memory indices = _toArr(LibKami.getIndex(components, aKamiID));
    vm.prank(deployer);
    __HarvestAdminSystem.stopBatched(indices);

    assertEq(_getItemBal(alice, MUSU_INDEX), expected, "owner not paid the synced balance and the next window");
    assertEq(LibHarvest.getBalance(components, prodID), 0, "harvest balance not cleared");
  }

  function _toArr(uint32 value) internal pure returns (uint32[] memory arr) {
    arr = new uint32[](1);
    arr[0] = value;
  }
}
