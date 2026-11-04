// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import "./Item.t.sol";
import { LibData } from "libraries/LibData.sol";
import { LibStat } from "libraries/LibStat.sol";
import { RESPEC_POTION_INDEX } from "systems/SkillRespecSystem.sol";

uint32 constant MOCHI_CAP = 2;

contract ItemKamiTest is ItemTemplate {
  //todo:
  // 1. test account permissions
  // 2. test revive state
  // 3. test room constraints
  // 4. test cooldown
  // 5. test effects - basic, more detailed testing in allo

  function testItemKamiBonus() public {
    uint32 itemA = 111;
    uint32 itemB = 112;
    uint32 itemC = 113;
    _createConsumable(itemA, "KAMI");
    _createConsumable(itemB, "KAMI");
    _createConsumable(itemC, "KAMI");
    vm.startPrank(deployer);
    __ItemRegistrySystem.addAlloBonus(
      abi.encode(itemA, "USE", "BONUS_1", "UPON_HARVEST_ACTION", 0, 3)
    );
    __ItemRegistrySystem.addAlloBonus(
      abi.encode(itemB, "USE", "BONUS_1", "UPON_HARVEST_ACTION", 0, 5)
    );
    __ItemRegistrySystem.addAlloBonus(
      abi.encode(itemC, "USE", "BONUS_2", "UPON_HARVEST_ACTION", 0, 7)
    );
    __ItemRegistrySystem.addFlag(itemA, "BYPASS_BONUS_RESET");
    __ItemRegistrySystem.addFlag(itemB, "BYPASS_BONUS_RESET");
    __ItemRegistrySystem.addFlag(itemC, "BYPASS_BONUS_RESET");
    vm.stopPrank();

    // alice setup
    uint256 kamiID = _mintKami(alice);
    _giveItem(alice, itemA, 10);
    _giveItem(alice, itemB, 10);
    _giveItem(alice, itemC, 10);

    // use itemA
    vm.prank(alice.operator);
    _KamiUseItemSystem.executeTyped(kamiID, itemA);
    assertEq(LibBonus.getFor(components, "BONUS_1", kamiID), 3);
    assertEq(LibBonus.getFor(components, "BONUS_2", kamiID), 0);

    // use itemA again, should not stack
    vm.prank(alice.operator);
    _KamiUseItemSystem.executeTyped(kamiID, itemA);
    assertEq(LibBonus.getFor(components, "BONUS_1", kamiID), 3);
    assertEq(LibBonus.getFor(components, "BONUS_2", kamiID), 0);

    // use itemB, should stack
    vm.prank(alice.operator);
    _KamiUseItemSystem.executeTyped(kamiID, itemB);
    assertEq(LibBonus.getFor(components, "BONUS_1", kamiID), 8);
    assertEq(LibBonus.getFor(components, "BONUS_2", kamiID), 0);

    // use itemC, should increase BONUS_2
    vm.prank(alice.operator);
    _KamiUseItemSystem.executeTyped(kamiID, itemC);
    assertEq(LibBonus.getFor(components, "BONUS_1", kamiID), 8);
    assertEq(LibBonus.getFor(components, "BONUS_2", kamiID), 7);

    // use itemA again, should not stack
    vm.prank(alice.operator);
    _KamiUseItemSystem.executeTyped(kamiID, itemA);
    assertEq(LibBonus.getFor(components, "BONUS_1", kamiID), 8);
    assertEq(LibBonus.getFor(components, "BONUS_2", kamiID), 7);

    // feeding food, will reset bonuses
    uint32 foodIndex = 114;
    _createFood(foodIndex, "name", "description", 0, 0, "media");
    _giveItem(alice, foodIndex, 10);
    vm.prank(alice.operator);
    _KamiUseItemSystem.executeTyped(kamiID, foodIndex);
    assertEq(LibBonus.getFor(components, "BONUS_1", alice.id), 0);
    assertEq(LibBonus.getFor(components, "BONUS_2", alice.id), 0);
  }

  /////////////////
  // MOCHI

  // mochi: permanent stat shift, capped at MOCHI_CAP per kami across all mochi types.
  // the cap is data-driven: a MOCHI_USED allo increments the kami counter the requirement reads
  function _createMochi(uint32 index, string memory statType, int32 shift) internal {
    vm.startPrank(deployer);
    __ItemRegistrySystem.createConsumable(
      abi.encode(index, "KAMI", "Mochi", "description", "FOOD", "media")
    );
    __ItemRegistrySystem.addRequirement(
      abi.encode(index, "USE", "KAMI_CAN_EAT", "BOOL_IS", 0, 0, "")
    );
    __ItemRegistrySystem.addRequirement(
      abi.encode(index, "USE", "MOCHI_USED", "CURR_MAX", 0, MOCHI_CAP - 1, "")
    );
    __ItemRegistrySystem.addAlloStat(abi.encode(index, "USE", statType, 0, shift, 0, 0));
    __ItemRegistrySystem.addAlloBasic(abi.encode(index, "USE", "MOCHI_USED", 0, 1));
    vm.stopPrank();
  }

  function _mochiUsed(uint256 kamiID) internal view returns (uint256) {
    return LibData.get(components, kamiID, 0, "MOCHI_USED");
  }

  function testMochiCapPerKami() public {
    uint32 hpMochi = 11110;
    _createMochi(hpMochi, "HEALTH", 10);

    uint256 kamiID = _mintKami(alice);
    _giveItem(alice, hpMochi, 3);
    int32 shiftBefore = LibStat.get(components, "HEALTH", kamiID).shift;

    vm.startPrank(alice.operator);
    _KamiUseItemSystem.executeTyped(kamiID, hpMochi);
    _KamiUseItemSystem.executeTyped(kamiID, hpMochi);
    vm.expectRevert("Item: requirements not met");
    _KamiUseItemSystem.executeTyped(kamiID, hpMochi);
    vm.stopPrank();

    assertEq(_mochiUsed(kamiID), MOCHI_CAP);
    assertEq(LibStat.get(components, "HEALTH", kamiID).shift, shiftBefore + 20);
    assertEq(LibInventory.getBalanceOf(components, alice.id, hpMochi), 1);
  }

  function testMochiCapSharedAcrossTypes() public {
    uint32 hpMochi = 11110;
    uint32 powerMochi = 11120;
    uint32 violenceMochi = 11130;
    _createMochi(hpMochi, "HEALTH", 10);
    _createMochi(powerMochi, "POWER", 1);
    _createMochi(violenceMochi, "VIOLENCE", 1);

    uint256 kamiID = _mintKami(alice);
    _giveItem(alice, hpMochi, 1);
    _giveItem(alice, powerMochi, 1);
    _giveItem(alice, violenceMochi, 1);
    int32 powerBefore = LibStat.get(components, "POWER", kamiID).shift;
    int32 violenceBefore = LibStat.get(components, "VIOLENCE", kamiID).shift;

    vm.startPrank(alice.operator);
    _KamiUseItemSystem.executeTyped(kamiID, hpMochi);
    _KamiUseItemSystem.executeTyped(kamiID, powerMochi);
    vm.expectRevert("Item: requirements not met");
    _KamiUseItemSystem.executeTyped(kamiID, violenceMochi);
    vm.stopPrank();

    assertEq(_mochiUsed(kamiID), MOCHI_CAP);
    assertEq(LibStat.get(components, "POWER", kamiID).shift, powerBefore + 1);
    assertEq(LibStat.get(components, "VIOLENCE", kamiID).shift, violenceBefore);
  }

  function testMochiCapIsPerKami() public {
    uint32 hpMochi = 11110;
    _createMochi(hpMochi, "HEALTH", 10);

    uint256 kamiA = _mintKami(alice);
    uint256 kamiB = _mintKami(alice);
    _giveItem(alice, hpMochi, 5);

    vm.startPrank(alice.operator);
    _KamiUseItemSystem.executeTyped(kamiA, hpMochi);
    _KamiUseItemSystem.executeTyped(kamiA, hpMochi);
    vm.expectRevert("Item: requirements not met");
    _KamiUseItemSystem.executeTyped(kamiA, hpMochi);

    _KamiUseItemSystem.executeTyped(kamiB, hpMochi);
    _KamiUseItemSystem.executeTyped(kamiB, hpMochi);
    vm.expectRevert("Item: requirements not met");
    _KamiUseItemSystem.executeTyped(kamiB, hpMochi);
    vm.stopPrank();

    assertEq(_mochiUsed(kamiA), MOCHI_CAP);
    assertEq(_mochiUsed(kamiB), MOCHI_CAP);
    assertEq(LibInventory.getBalanceOf(components, alice.id, hpMochi), 1);
  }

  function testMochiSurvivesRespec() public {
    uint32 hpMochi = 11110;
    uint32 harmonyMochi = 11140;
    _createMochi(hpMochi, "HEALTH", 10);
    _createMochi(harmonyMochi, "HARMONY", 1);

    uint256 kamiID = _mintKami(alice);
    _giveItem(alice, hpMochi, 2);
    _giveItem(alice, harmonyMochi, 1);
    int32 healthBefore = LibStat.get(components, "HEALTH", kamiID).shift;
    int32 harmonyBefore = LibStat.get(components, "HARMONY", kamiID).shift;

    vm.startPrank(alice.operator);
    _KamiUseItemSystem.executeTyped(kamiID, hpMochi);
    _KamiUseItemSystem.executeTyped(kamiID, harmonyMochi);
    vm.stopPrank();

    _giveItem(alice, RESPEC_POTION_INDEX, 1);
    vm.prank(alice.operator);
    _SkillRespecSystem.executeTyped(kamiID);

    // stat shifts and the counter are untouched by a respec
    assertEq(LibStat.get(components, "HEALTH", kamiID).shift, healthBefore + 10);
    assertEq(LibStat.get(components, "HARMONY", kamiID).shift, harmonyBefore + 1);
    assertEq(_mochiUsed(kamiID), MOCHI_CAP);

    vm.prank(alice.operator);
    vm.expectRevert("Item: requirements not met");
    _KamiUseItemSystem.executeTyped(kamiID, hpMochi);
  }
}
