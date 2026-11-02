// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import "tests/utils/SetupTemplate.t.sol";

contract AuctionTest is SetupTemplate {
  // a generic item: gacha/reroll tickets also gate on the gacha pool
  uint32 constant ITEM = 2001;

  // the live Gacha <> Musu curve
  uint32 constant TARGET = 32000;
  int32 constant PERIOD = 1 days;
  int32 constant DECAY = 750000; // 0.75 per period (1e6)
  int32 constant RATE = 32;
  int32 constant MAX = 17222;

  uint256 auctionID;

  function setUp() public override {
    super.setUp();
    _createGenericItem(MUSU_INDEX);
    _createGenericItem(ITEM);

    vm.prank(deployer);
    auctionID = __AuctionRegistrySystem.create(
      ITEM,
      MUSU_INDEX,
      TARGET,
      PERIOD,
      DECAY,
      RATE,
      MAX,
      block.timestamp
    );
  }

  /////////////////
  // PRICING

  /// @dev a halt adds elapsed time with no sales; skipping the window restores the price
  function testPauseRestoresPrePausePrice() public {
    _fastForward(1 days);
    uint256 before = _price(1);
    uint64 pauseStart = uint64(block.timestamp);

    _fastForward(3 days); // the chain is halted
    uint64 pauseEnd = uint64(block.timestamp);
    assertLt(_price(1), before);

    _setPause(pauseStart, pauseEnd);
    assertEq(_price(1), before);

    // time after the pause decays as normal
    _fastForward(1 days);
    assertLt(_price(1), before);
  }

  /// @dev only the window counts: a pause in the past still skips just its own length
  function testPauseSkipsOnlyItsWindow() public {
    _fastForward(1 days);
    uint64 pauseStart = uint64(block.timestamp);
    _fastForward(2 days);
    uint64 pauseEnd = uint64(block.timestamp);
    _fastForward(1 days); // set late, a day after the chain came back

    _setPause(pauseStart, pauseEnd);
    uint256 withPause = _price(1);

    // same as an auction that ran 2 days, without the 2-day halt
    _createGenericItem(ITEM + 1);
    vm.prank(deployer);
    uint256 refID = __AuctionRegistrySystem.create(
      ITEM + 1,
      MUSU_INDEX,
      TARGET,
      PERIOD,
      DECAY,
      RATE,
      MAX,
      block.timestamp - 2 days
    );
    assertEq(withPause, LibAuction.calcBuy(components, refID, 1));
  }

  function testPauseIgnoresOtherAuctions() public {
    _createGenericItem(ITEM + 1);
    vm.prank(deployer);
    uint256 otherID = __AuctionRegistrySystem.create(
      ITEM + 1,
      MUSU_INDEX,
      TARGET,
      PERIOD,
      DECAY,
      RATE,
      MAX,
      block.timestamp
    );
    uint64 pauseStart = uint64(block.timestamp);
    _fastForward(2 days);
    uint256 otherBefore = LibAuction.calcBuy(components, otherID, 1);

    _setPause(pauseStart, uint64(block.timestamp));
    assertEq(LibAuction.calcBuy(components, otherID, 1), otherBefore);
    assertGt(_price(1), otherBefore);
  }

  function testBuyChargesPausedPrice() public {
    _fastForward(1 days);
    uint256 before = _price(2);
    uint64 pauseStart = uint64(block.timestamp);
    _fastForward(3 days);
    _setPause(pauseStart, uint64(block.timestamp));

    uint256 musu = before + 1000;
    _giveItem(alice, MUSU_INDEX, musu);
    _buy(2);

    assertEq(_getItemBal(alice, MUSU_INDEX), musu - before);
    assertEq(_getItemBal(alice, ITEM), 2);
  }

  /////////////////
  // SETTER

  function testSetPauseOnlyAdmin() public {
    _fastForward(1 days);
    vm.prank(alice.owner);
    vm.expectRevert("Auth: not an admin");
    __AuctionRegistrySystem.setPause(ITEM, uint64(block.timestamp - 1 hours), uint64(block.timestamp));
  }

  function testSetPauseUnknownAuction() public {
    vm.prank(deployer);
    vm.expectRevert("AuctionRegistry: auction does not exist");
    __AuctionRegistrySystem.setPause(ITEM + 99, 0, 0);
  }

  /// @dev bad windows fail at the admin tx instead of breaking buys
  function testSetPauseRejectsBadWindows() public {
    _fastForward(1 days);
    uint64 now_ = uint64(block.timestamp);
    uint64 startTs = uint64(LibAuctionRegistry.getStartTs(components, auctionID));

    vm.startPrank(deployer);
    vm.expectRevert("AuctionRegistry: pause must end after it starts");
    __AuctionRegistrySystem.setPause(ITEM, now_ - 1 hours, now_ - 1 hours);
    vm.expectRevert("AuctionRegistry: pause must end after it starts");
    __AuctionRegistrySystem.setPause(ITEM, now_ - 1 hours, now_ - 2 hours);
    vm.expectRevert("AuctionRegistry: pause has not ended");
    __AuctionRegistrySystem.setPause(ITEM, now_ - 1 hours, now_ + 1);
    vm.expectRevert("AuctionRegistry: pause has not ended");
    __AuctionRegistrySystem.setPause(ITEM, now_, type(uint64).max);
    vm.expectRevert("AuctionRegistry: pause starts before the auction");
    __AuctionRegistrySystem.setPause(ITEM, startTs - 1, now_);
    vm.stopPrank();
  }

  function testSetPauseReplacesAndClears() public {
    _fastForward(2 days);
    uint64 now_ = uint64(block.timestamp);
    _setPause(now_ - 2 days, now_ - 1 days);
    _setPause(now_ - 1 days, now_);
    assertEq(_TimePauseComponent.get(auctionID), (uint256(now_ - 1 days) << 64) | now_);

    _setPause(0, 0);
    assertFalse(_TimePauseComponent.has(auctionID));
  }

  function testRemoveClearsPause() public {
    _fastForward(1 days);
    _setPause(uint64(block.timestamp - 1 hours), uint64(block.timestamp));
    vm.prank(deployer);
    __AuctionRegistrySystem.remove(ITEM);
    assertFalse(_TimePauseComponent.has(auctionID));
  }

  /// @dev the layout the client's unpackPause mirrors
  function testPauseLayout() public pure {
    uint64 start = 1_700_000_000;
    uint64 end = 1_700_259_200;
    uint256 packed = LibAuctionRegistry.packPause(start, end);
    assertEq(packed, (uint256(start) << 64) | uint256(end));
    (uint64 s, uint64 e) = LibAuctionRegistry.unpackPause(packed);
    assertEq(s, start);
    assertEq(e, end);
  }

  /// @dev create used to return the pre-create lookup (always 0)
  function testCreateReturnsAuctionID() public view {
    assertEq(auctionID, LibAuctionRegistry.get(components, ITEM));
    assertTrue(auctionID != 0);
  }

  /////////////////
  // UTILS

  function _price(uint32 amt) internal view returns (uint256) {
    return LibAuction.calcBuy(components, auctionID, amt);
  }

  function _setPause(uint64 pauseStart, uint64 pauseEnd) internal {
    vm.prank(deployer);
    __AuctionRegistrySystem.setPause(ITEM, pauseStart, pauseEnd);
  }

  function _buy(uint32 amt) internal {
    if (_getItemBal(alice, MUSU_INDEX) < _price(amt)) _giveItem(alice, MUSU_INDEX, _price(amt));
    vm.prank(alice.operator);
    _AuctionBuySystem.executeTyped(ITEM, amt);
  }
}
