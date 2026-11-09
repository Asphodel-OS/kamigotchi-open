// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import "tests/utils/SetupTemplate.t.sol";

import { LibKill } from "libraries/LibKill.sol";
import { HARV_MULT_MAX, HARV_MULT_MIN, HARV_MULT_PREC } from "libraries/LibNode.sol";
import { LibStat } from "libraries/LibStat.sol";

/// @notice harvest multiplier K: each stretch pays today's bounty × the K stored when it opened; the
///  bounty, HP strain and the starve cap stay exactly today's
contract HarvestMultiplierTest is SetupTemplate {
  uint32 constant NODE_A = 1; // NORMAL, room 1 (SetupTemplate)
  uint32 constant NODE_B = 5; // second NORMAL node in room 1
  uint32 constant ENEMY_ITEM = 211;

  uint256 nodeA;
  uint256 nodeB;

  function setUp() public override {
    super.setUp();
    nodeA = LibNode.getByIndex(components, NODE_A);
    nodeB = _createHarvestingNode(NODE_B, 1, "Test Node B", "this is a node", "NORMAL");

    vm.startPrank(deployer);
    __ItemRegistrySystem.createConsumable(
      abi.encode(ENEMY_ITEM, "ENEMY_KAMI", "name", "description", "POTION", "media")
    );
    __ItemRegistrySystem.addAlloBonus(
      abi.encode(ENEMY_ITEM, "USE", "BONUS_ENEMY", "UPON_KILL_OR_KILLED", 0, 1)
    );
    vm.stopPrank();
  }

  /////////////////
  // CREDIT

  function testMultiplierOneIsToday() public {
    uint256 kamiID = _mintKami(alice);
    uint256 prodID = _startHarvest(kamiID, NODE_A);
    assertEq(_nodeK(nodeA), HARV_MULT_PREC, "node created at 1.0");
    assertEq(_copyK(prodID), HARV_MULT_PREC, "copy at 1.0");

    _fastForward(4 hours);
    uint256 base = LibHarvest.calcBounty(components, prodID);
    _feedKami(alice, kamiID);
    assertEq(LibHarvest.getBalance(components, prodID), base, "K 1.0 credits the base");
  }

  function testMultiplierTranches() public {
    uint256 kamiID = _mintKami(alice);
    _setK(NODE_A, 800);
    uint256 prodID = _startHarvest(kamiID, NODE_A);
    assertEq(_copyK(prodID), 800, "copy taken at start");

    _fastForward(4 hours);
    uint256 expected = _credit(prodID, 800);
    _feedKami(alice, kamiID);
    assertEq(LibHarvest.getBalance(components, prodID), expected, "tranche 1 at 0.8");

    // a change mid-stretch: the open stretch keeps the K it opened at
    _setK(NODE_A, 1500);
    _fastForward(4 hours);
    expected += _credit(prodID, 800);
    _feedKami(alice, kamiID);
    assertEq(LibHarvest.getBalance(components, prodID), expected, "tranche 2 still at 0.8");
    assertEq(_copyK(prodID), 1500, "copy refreshed after crediting");

    _fastForward(4 hours);
    expected += _credit(prodID, 1500);
    _feedKami(alice, kamiID);
    assertEq(LibHarvest.getBalance(components, prodID), expected, "tranche 3 at 1.5");
  }

  function testMultiplierHpDrainStaysOnBase() public {
    uint256 kamiID = _mintKami(alice);
    _setK(NODE_A, 500);
    uint256 prodID = _startHarvest(kamiID, NODE_A);
    _fastForward(4 hours);

    uint256 base = LibHarvest.calcBounty(components, prodID);
    uint256 strain = LibKami.calcStrain(components, kamiID, base);
    uint256 expected = _credit(prodID, 500);
    int32 hpBefore = _hp(kamiID);
    ExternalCaller.kamiSync(kamiID);

    assertEq(LibHarvest.getBalance(components, prodID), expected, "balance at 0.5");
    assertEq(uint256(int256(hpBefore - _hp(kamiID))), strain, "strain charged on the base");
  }

  // at 1.0 every stretch credits and charges what it does today, however often the kami syncs
  function testMultiplierOneMatchesToday() public {
    uint256 kamiID = _mintKami(alice);
    uint256 prodID = _startHarvest(kamiID, NODE_A);
    for (uint256 i; i < 40; i++) {
      _fastForward(97);
      uint256 today = LibHarvest.calcBounty(components, prodID);
      (uint256 credit, ) = _settle(prodID);
      assertEq(credit, today, "credit differs from today");
      uint256 balance = LibHarvest.getBalance(components, prodID);
      int32 hpBefore = _hp(kamiID);
      ExternalCaller.kamiSync(kamiID);
      assertEq(LibHarvest.getBalance(components, prodID), balance + today, "balance");
      assertEq(
        uint256(int256(hpBefore - _hp(kamiID))),
        LibKami.calcStrain(components, kamiID, today),
        "hp"
      );
    }
  }

  // frequent syncs pay each stretch's bounty × K, rounded to the nearest MUSU, and drain today's HP
  // at every K: over many syncs the rounding stays within half a MUSU per sync of K × today
  function testMultiplierShortStretchesPayKTimesToday() public {
    uint32[4] memory ks = [uint32(1100), 1200, 2000, HARV_MULT_MAX];
    for (uint256 j; j < ks.length; j++) {
      uint256 kamiID = _mintKami(alice);
      _setK(NODE_A, ks[j]);
      uint256 prodID = _startHarvest(kamiID, NODE_A);
      int32 hpBefore = _hp(kamiID);
      uint256 today;
      uint256 paid;
      uint256 strained;
      for (uint256 i; i < 60; i++) {
        _fastForward(10 minutes);
        uint256 bounty = LibHarvest.calcBounty(components, prodID);
        today += bounty;
        paid += (bounty * ks[j] + HARV_MULT_PREC / 2) / HARV_MULT_PREC;
        strained += LibKami.calcStrain(components, kamiID, bounty);
        ExternalCaller.kamiSync(kamiID);
      }
      assertTrue(today > 0, "nothing earned");
      assertEq(LibHarvest.getBalance(components, prodID), paid, "not each stretch x K, rounded");
      assertApproxEqAbs(paid * HARV_MULT_PREC, today * ks[j], 60 * (HARV_MULT_PREC / 2), "drifts from K x today");
      assertEq(uint256(int256(hpBefore - _hp(kamiID))), strained, "hp not as today");
    }
  }

  // K is the low 16 bits: a value with higher bits set reads its K, and the next sync rewrites it as
  // K alone
  function testMultiplierCopyReadsLowBits() public {
    uint256 kamiID = _mintKami(alice);
    _setK(NODE_A, 800);
    uint256 prodID = _startHarvest(kamiID, NODE_A);
    vm.prank(deployer);
    _HarvestMultiplierComponent.set(prodID, (uint256(1) << 255) | (uint256(500) << 16) | 800);
    assertEq(_copyK(prodID), 800, "K not read from the low bits");

    _fastForward(1 hours);
    ExternalCaller.kamiSync(kamiID);
    assertEq(_HarvestMultiplierComponent.get(prodID), 800, "copy not rewritten as K alone");
  }

  // each sync's credit is the bounty × K rounded to the nearest whole MUSU; 0 stays 0
  function testMultiplierCreditRoundsToNearest() public {
    uint256 kamiID = _mintKami(alice);
    _setK(NODE_A, 1500);
    uint256 prodID = _startHarvest(kamiID, NODE_A);
    assertEq(LibHarvest.calcCredit(components, prodID, 5), 8, "7.5 rounds up");
    assertEq(LibHarvest.calcCredit(components, prodID, 3), 5, "4.5 rounds up");
    assertEq(LibHarvest.calcCredit(components, prodID, 1), 2, "1.5 rounds up");
    assertEq(LibHarvest.calcCredit(components, prodID, 0), 0, "nothing earned pays nothing");
    _setK(NODE_A, 1100);
    vm.prank(deployer);
    _HarvestMultiplierComponent.set(prodID, 1100);
    assertEq(LibHarvest.calcCredit(components, prodID, 3), 3, "3.3 rounds down");
    assertEq(LibHarvest.calcCredit(components, prodID, 9), 10, "9.9 rounds up");
    vm.prank(deployer);
    _HarvestMultiplierComponent.set(prodID, HARV_MULT_PREC);
    assertEq(LibHarvest.calcCredit(components, prodID, 7), 7, "1.0 pays the bounty exactly");
  }

  // the copy is written only when the node's K changes, at whole and fractional K alike
  function testMultiplierCopyWrittenOnChange() public {
    uint256 kamiID = _mintKami(alice);
    _setK(NODE_A, 2000);
    uint256 prodID = _startHarvest(kamiID, NODE_A);
    address comp = address(LibNode.getMultiplierComp(components));
    _fastForward(1 hours);
    vm.record();
    ExternalCaller.kamiSync(kamiID);
    (, bytes32[] memory writes) = vm.accesses(comp);
    assertEq(writes.length, 0, "copy rewritten at an unchanged K");

    _setK(NODE_A, 1100);
    _fastForward(1 hours);
    vm.record();
    ExternalCaller.kamiSync(kamiID);
    (, writes) = vm.accesses(comp);
    assertTrue(writes.length > 0, "copy not refreshed");
    assertEq(_copyK(prodID), 1100, "copy not at the new K");

    _fastForward(1 hours);
    vm.record();
    ExternalCaller.kamiSync(kamiID);
    (, writes) = vm.accesses(comp);
    assertEq(writes.length, 0, "copy rewritten at an unchanged fractional K");
  }

  // a kami at zero HP earns nothing however often it syncs, at any K
  function testMultiplierStarvedKamiEarnsNothing() public {
    uint256 kamiID = _mintKami(alice);
    _setK(NODE_A, 2000);
    vm.prank(deployer);
    _HealthComponent.set(kamiID, Stat(10, 0, 0, 10));
    uint256 prodID = _startHarvest(kamiID, NODE_A);
    _fastForward(24 hours);
    ExternalCaller.kamiSync(kamiID);
    assertEq(_hp(kamiID), 0, "kami not starved");
    uint256 balance = LibHarvest.getBalance(components, prodID);
    for (uint256 i; i < 5; i++) {
      _fastForward(1);
      ExternalCaller.kamiSync(kamiID);
    }
    _fastForward(1 hours);
    ExternalCaller.kamiSync(kamiID);
    assertEq(LibHarvest.getBalance(components, prodID), balance, "starved kami credited");
    assertEq(_hp(kamiID), 0, "hp moved");
  }

  function testMultiplierLegacyHarvestReadsNodeK() public {
    uint256 kamiID = _mintKami(alice);
    uint256 prodID = _startHarvest(kamiID, NODE_A);

    // a harvest running from before K has no copy: its first stretch pays the node's current K
    vm.prank(deployer);
    _HarvestMultiplierComponent.remove(prodID);
    _setK(NODE_A, 800);
    assertEq(_copyK(prodID), 800, "no copy reads the node's K");

    _fastForward(4 hours);
    uint256 expected = _credit(prodID, 800);
    _feedKami(alice, kamiID);
    assertEq(LibHarvest.getBalance(components, prodID), expected, "legacy stretch at the node's K");
    assertTrue(_HarvestMultiplierComponent.has(prodID), "copy written at the sync");
  }

  // a node that drips another item (VIPP) pays K × today's bounty in that item, on the same rules
  function testMultiplierOtherItemNode() public {
    uint32 nodeV = 6;
    uint32 vipp = 2;
    _createHarvestingNode(nodeV, 1, vipp, "Test Node V", "this is a node", "NORMAL");
    _setK(nodeV, 2000);
    uint256 kamiID = _mintKami(alice);
    uint256 prodID = _startHarvest(kamiID, nodeV);
    assertEq(_copyK(prodID), 2000, "copy taken at start");

    _fastForward(_idleRequirement + 4 hours);
    uint256 base = LibHarvest.calcBounty(components, prodID);
    uint256 strain = LibKami.calcStrain(components, kamiID, base);
    uint256 expected = _credit(prodID, 2000);
    int32 hpBefore = _hp(kamiID);
    _collectHarvest(prodID);
    assertEq(_getItemBal(alice, vipp), expected, "collect pays the node's item at 2.0");
    assertEq(_getItemBal(alice, MUSU_INDEX), 0, "no musu from a vipp node");
    assertEq(uint256(int256(hpBefore - _hp(kamiID))), strain, "strain charged on the base");
  }

  /////////////////
  // SYNC PATHS

  function testMultiplierCollectCreditsThenRefreshes() public {
    uint256 kamiID = _mintKami(alice);
    uint256 prodID = _startHarvest(kamiID, NODE_A);
    _fastForward(_idleRequirement + 4 hours);
    _setK(NODE_A, 500);

    uint256 base = LibHarvest.calcBounty(components, prodID);
    _collectHarvest(prodID);
    assertEq(_getItemBal(alice, MUSU_INDEX), base, "collect pays the open stretch at 1.0");
    assertEq(_copyK(prodID), 500, "copy refreshed at collect");

    _fastForward(_idleRequirement + 4 hours);
    uint256 expected2 = _credit(prodID, 500);
    _collectHarvest(prodID);
    assertEq(_getItemBal(alice, MUSU_INDEX), base + expected2, "next stretch at 0.5");
  }

  function testMultiplierCastRefreshesTarget() public {
    uint256 targetID = _mintKami(bob);
    uint256 prodID = _startHarvest(targetID, NODE_A);
    _fastForward(4 hours);
    _setK(NODE_A, 500);

    uint256 base = LibHarvest.calcBounty(components, prodID);
    _giveItem(alice, ENEMY_ITEM, 1);
    vm.prank(alice.operator);
    _KamiCastItemSystem.executeTyped(targetID, ENEMY_ITEM);
    assertEq(
      LibHarvest.getBalance(components, prodID),
      base,
      "cast credits the open stretch at 1.0"
    );
    assertEq(_copyK(prodID), 500, "cast refreshes the copy");
  }

  function testMultiplierKillFollowsK() public {
    uint256 victimID = _mintKami(alice);
    uint256 killerID = _mintKami(bob);
    _setK(NODE_A, 800);
    _fastForward(_idleRequirement);

    // the victim earns 12 hours at 0.8; the node goes to 2.0, which its next stretch copies at the feed
    uint256 vProdID = _startHarvest(victimID, NODE_A);
    _fastForward(12 hours);
    _setK(NODE_A, 2000);
    _feedKami(alice, victimID);
    assertEq(_copyK(vProdID), 2000, "the feed did not copy the new K");
    _fastForward(12 hours);
    uint256 kProdID = _startHarvest(killerID, NODE_A);
    _fastForward(_idleRequirement);
    vm.prank(deployer);
    _HealthComponent.set(killerID, Stat(1000, 0, 0, 1000)); // room for a full-bar recoil

    KillExpect memory e = _expectKill(victimID, killerID, vProdID, kProdID);
    int32 killerHp = _hp(killerID);
    _liquidateHarvest(killerID, vProdID);

    assertEq(
      LibHarvest.getBalance(components, kProdID),
      e.killerBefore + e.spoils,
      "spoils on the K bounty"
    );
    assertEq(_getItemBal(alice, MUSU_INDEX), e.salvage, "salvage on the K bounty");
    assertEq(uint256(int256(killerHp - _hp(killerID))), e.recoil, "recoil on the spoils");
    assertTrue(LibKami.isState(components, victimID, "DEAD"), "victim not dead");
  }

  // a victim at zero HP: its stretch stopped earning where the cap bound, a later K change on the node
  // pays it nothing, a sync changes nothing, and the kill charges recoil on the spoils as today
  function testMultiplierKillStarvedVictim() public {
    uint256 victimID = _mintKami(alice);
    uint256 killerID = _mintKami(bob);
    _setK(NODE_A, 800);
    vm.prank(deployer);
    _HealthComponent.set(victimID, Stat(10, 0, 0, 10)); // a tiny bar: starves within hours
    uint256 vProdID = _startHarvest(victimID, NODE_A);

    _fastForward(24 hours);
    _setK(NODE_A, 2000); // after it starved: the open stretch keeps 0.8 and has stopped earning
    _fastForward(6 hours);
    uint256 expected = _credit(vProdID, 800);
    ExternalCaller.kamiSync(victimID);
    assertEq(_hp(victimID), 0, "victim not starved");
    uint256 bounty = LibHarvest.getBalance(components, vProdID);
    assertEq(bounty, expected, "paid past zero HP or at the new K");
    _fastForward(1 hours);
    ExternalCaller.kamiSync(victimID);
    assertEq(
      LibHarvest.getBalance(components, vProdID),
      bounty,
      "a sync at zero HP credits nothing"
    );

    uint256 kProdID = _startHarvest(killerID, NODE_A);
    _fastForward(_idleRequirement);
    vm.prank(deployer);
    _HealthComponent.set(killerID, Stat(1000, 0, 0, 1000));
    uint256 salvage = LibKill.calcSalvage(components, victimID, bounty);
    uint256 spoils = LibKill.calcSpoils(components, killerID, bounty - salvage);
    uint256 recoil = LibKill.calcRecoil(
      components,
      victimID,
      killerID,
      LibKami.calcStrain(components, killerID, spoils)
    );
    (, uint256 killerCharged) = _settle(kProdID); // the killer syncs in the kill
    uint256 killerStrain = LibKami.calcStrain(components, killerID, killerCharged);
    int32 killerHp = _hp(killerID);
    _liquidateHarvest(killerID, vProdID);
    assertEq(
      uint256(int256(killerHp - _hp(killerID))),
      killerStrain + recoil,
      "recoil on the spoils"
    );
    assertTrue(LibKami.isState(components, victimID, "DEAD"), "victim not dead");
  }

  // a victim with nothing in its harvest: no spoils, no recoil
  function testMultiplierKillZeroBalance() public {
    uint256 victimID = _mintKami(alice);
    uint256 killerID = _mintKami(bob);
    _setK(NODE_A, 800);
    _fastForward(_idleRequirement);
    uint256 kProdID = _startHarvest(killerID, NODE_A);
    _fastForward(_idleRequirement);
    uint256 vProdID = _startHarvest(victimID, NODE_A);
    vm.prank(deployer);
    _HealthComponent.set(victimID, Stat(100, 0, 0, 0)); // out of HP before earning anything

    uint256 killerBase = LibHarvest.calcBounty(components, kProdID);
    uint256 killerCredit = _credit(kProdID, 800);
    int32 killerHp = _hp(killerID);
    _liquidateHarvest(killerID, vProdID);
    assertEq(
      uint256(int256(killerHp - _hp(killerID))),
      LibKami.calcStrain(components, killerID, killerBase),
      "recoil charged on nothing"
    );
    assertEq(LibHarvest.getBalance(components, kProdID), killerCredit, "no spoils");
    assertTrue(LibKami.isState(components, victimID, "DEAD"), "victim not dead");
  }

  // harvests from before K (no copy) on a node that has K now: the open stretches pay the node's
  // current K, the kill takes salvage and spoils from the K-scaled bounty, and the killer's copy is written
  function testMultiplierKillLegacyHarvests() public {
    uint256 victimID = _mintKami(alice);
    uint256 killerID = _mintKami(bob);
    _fastForward(_idleRequirement);
    uint256 vProdID = _startHarvest(victimID, NODE_A);
    _fastForward(12 hours);
    _feedKami(alice, victimID);
    _fastForward(12 hours);
    uint256 kProdID = _startHarvest(killerID, NODE_A);
    _fastForward(_idleRequirement);
    _setK(NODE_A, 800);
    vm.startPrank(deployer);
    _HarvestMultiplierComponent.remove(vProdID);
    _HarvestMultiplierComponent.remove(kProdID);
    _HealthComponent.set(killerID, Stat(1000, 0, 0, 1000));
    vm.stopPrank();

    uint256 bounty = LibHarvest.getBalance(components, vProdID) + _credit(vProdID, 800);
    uint256 salvage = LibKill.calcSalvage(components, victimID, bounty);
    uint256 spoils = LibKill.calcSpoils(components, killerID, bounty - salvage);
    uint256 killerBase = LibHarvest.calcBounty(components, kProdID);
    uint256 killerCredit = _credit(kProdID, 800);
    uint256 recoil = LibKill.calcRecoil(
      components,
      victimID,
      killerID,
      LibKami.calcStrain(components, killerID, spoils)
    );
    int32 killerHp = _hp(killerID);
    _liquidateHarvest(killerID, vProdID);

    assertEq(
      uint256(int256(killerHp - _hp(killerID))),
      LibKami.calcStrain(components, killerID, killerBase) + recoil,
      "strain on the base, recoil on the spoils"
    );
    assertEq(_copyK(kProdID), 800, "killer copy picked up the node's K");
    assertEq(
      LibHarvest.getBalance(components, kProdID),
      killerCredit + spoils,
      "legacy stretch paid at the node's K, spoils added"
    );
  }

  function testMultiplierAdminStopAfterChange() public {
    uint256 kamiID = _mintKami(alice);
    uint256 prodID = _startHarvest(kamiID, NODE_A);
    _fastForward(4 hours);
    _setK(NODE_A, 500);

    // admin stop resolves the caller's account, so the admin needs one: promote alice's operator
    uint32 kamiIndex = LibKami.getIndex(components, kamiID);
    vm.prank(deployer);
    __AuthManageRoleSystem.addRole(alice.operator, "ROLE_ADMIN");
    uint256 bounty = LibHarvest.calcBounty(components, prodID);
    int32 hpBefore = _hp(kamiID);
    vm.prank(alice.operator);
    __HarvestAdminSystem.stop(kamiIndex);
    assertFalse(LibHarvest.isActive(components, prodID), "harvest still active");
    assertEq(
      uint256(int256(hpBefore - _hp(kamiID))),
      LibKami.calcStrain(components, kamiID, bounty),
      "strain not as today"
    );
    assertEq(_copyK(prodID), 500, "copy not refreshed by the stop's sync");
    assertEq(LibHarvest.getBalance(components, prodID), 0, "the stop keeps a balance");
    assertTrue(LibKami.isState(components, kamiID, "RESTING"), "kami not resting");
  }

  // a node is born with its K: create stores it and checks its bounds
  function testMultiplierCreateSetsK() public {
    vm.startPrank(deployer);
    uint256 id = __NodeRegistrySystem.create(
      abi.encode(uint32(6), "HARVEST", uint32(1), uint32(1), "Node K", "d", "NORMAL", uint32(2500))
    );
    assertEq(_nodeK(id), 2500, "create stores K");

    vm.expectRevert("Node: multiplier out of range");
    __NodeRegistrySystem.create(
      abi.encode(uint32(7), "HARVEST", uint32(1), uint32(1), "Node 0", "d", "NORMAL", uint32(0))
    );
    vm.stopPrank();
  }

  /////////////////
  // ADMIN AND REGISTRY

  function testMultiplierSetterGates() public {
    vm.prank(alice.operator);
    vm.expectRevert("Auth: not an admin");
    __NodeRegistrySystem.setMultiplier(NODE_A, 800);

    vm.prank(deployer);
    vm.expectRevert("Node: does not exist");
    __NodeRegistrySystem.setMultiplier(99, 800);

    // typo insurance: 0.1 to 60
    vm.startPrank(deployer);
    vm.expectRevert("Node: multiplier out of range");
    __NodeRegistrySystem.setMultiplier(NODE_A, HARV_MULT_MIN - 1);
    vm.expectRevert("Node: multiplier out of range");
    __NodeRegistrySystem.setMultiplier(NODE_A, HARV_MULT_MAX + 1);
    __NodeRegistrySystem.setMultiplier(NODE_A, HARV_MULT_MIN);
    __NodeRegistrySystem.setMultiplier(NODE_A, HARV_MULT_MAX);
    vm.stopPrank();
    assertEq(_nodeK(nodeA), HARV_MULT_MAX, "bounds inclusive");
  }

  // removing a node keeps its K: in a revise (remove, then create) a harvest on it must not read
  // no K in between; create overwrites it
  function testMultiplierNodeRemoveKeepsK() public {
    _setK(NODE_B, 800);
    uint256 kamiID = _mintKami(alice);
    uint256 prodID = _startHarvest(kamiID, NODE_B);
    vm.startPrank(deployer);
    _HarvestMultiplierComponent.remove(prodID); // no copy: the harvest reads its node's K
    __NodeRegistrySystem.remove(NODE_B);
    vm.stopPrank();
    assertEq(_nodeK(nodeB), 800, "remove cleared K");

    _fastForward(1 hours);
    uint256 expected = _credit(prodID, 800);
    assertGt(expected, 0, "nothing earned");
    ExternalCaller.kamiSync(kamiID);
    assertEq(LibHarvest.getBalance(components, prodID), expected, "harvest on a removed node not paid its K");

    _createHarvestingNode(NODE_B, 1, "Test Node B", "this is a node", "NORMAL");
    assertEq(_nodeK(nodeB), HARV_MULT_PREC, "re-created node takes the K it is created with");
  }

  function testMultiplierWriteAccess() public view {
    address[8] memory writers = [
      address(_HarvestStartSystem),
      address(_HarvestCollectSystem),
      address(_HarvestStopSystem),
      address(_HarvestLiquidateSystem),
      address(_KamiUseItemSystem),
      address(_KamiCastItemSystem),
      address(__HarvestAdminSystem),
      address(__NodeRegistrySystem)
    ];
    for (uint256 i; i < writers.length; i++) {
      assertTrue(_HarvestMultiplierComponent.writeAccess(writers[i]), "missing K write access");
    }
  }

  /////////////////
  // UTILS

  function _setK(uint32 nodeIndex, uint32 k) internal {
    vm.prank(deployer);
    __NodeRegistrySystem.setMultiplier(nodeIndex, k);
  }

  // the node's K
  function _nodeK(uint256 nodeID) internal view returns (uint32) {
    return LibNode.getBaseMultiplier(components, nodeID);
  }

  // the K a harvest's open stretch pays
  function _copyK(uint256 prodID) internal view returns (uint32) {
    return LibHarvest.getCopy(components, prodID);
  }

  // what a sync now credits, and today's bounty: the whole base MUSU strain is charged on
  function _settle(uint256 prodID) internal view returns (uint256 credit, uint256 bounty) {
    bounty = LibHarvest.calcBounty(components, prodID);
    credit = LibHarvest.calcCredit(components, prodID, bounty);
  }

  // the credit of the open stretch at K: today's bounty × K, rounded to the nearest MUSU
  function _credit(uint256 prodID, uint32 k) internal view returns (uint256) {
    uint256 bounty = LibHarvest.calcBounty(components, prodID);
    return (bounty * k + HARV_MULT_PREC / 2) / HARV_MULT_PREC;
  }

  struct KillExpect {
    uint256 bounty;
    uint256 salvage;
    uint256 spoils;
    uint256 recoil;
    uint256 killerBefore;
  }

  // what a kill pays and costs, as both kamis will sync inside it: each open stretch at the K it
  // copied; recoil is charged on the spoils, as today
  function _expectKill(
    uint256 victimID,
    uint256 killerID,
    uint256 vProdID,
    uint256 kProdID
  ) internal view returns (KillExpect memory e) {
    e.bounty = LibHarvest.getBalance(components, vProdID) + _credit(vProdID, _copyK(vProdID));
    e.salvage = LibKill.calcSalvage(components, victimID, e.bounty);
    e.spoils = LibKill.calcSpoils(components, killerID, e.bounty - e.salvage);
    e.recoil = LibKill.calcRecoil(
      components,
      victimID,
      killerID,
      LibKami.calcStrain(components, killerID, e.spoils)
    );
    e.killerBefore = LibHarvest.getBalance(components, kProdID) + _credit(kProdID, _copyK(kProdID));
  }

  function _hp(uint256 kamiID) internal view returns (int32) {
    return LibStat.getCurrent(components, "HEALTH", kamiID);
  }
}
