// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { System } from "solecs/System.sol";
import { IWorld } from "solecs/interfaces/IWorld.sol";

import { AuthRoles } from "libraries/utils/AuthRoles.sol";
import { Condition } from "libraries/LibConditional.sol";
import { LibItem } from "libraries/LibItem.sol";
import { LibAuctionRegistry, Params } from "libraries/LibAuctionRegistry.sol";

uint256 constant ID = uint256(keccak256("system.auction.registry"));

// create or update a Listing on a NPC by its Merchnat Index
contract _AuctionRegistrySystem is System, AuthRoles {
  constructor(IWorld _world, address _components) System(_world, _components) {}

  function create(
    uint32 itemIndex, // index of the item being auctioned
    uint32 payItemIndex, // index of the item used to pay for auction
    uint32 priceTarget, // initial price target of the item being auctioned
    int32 period, // reference duration period (in seconds)
    int32 decay, // price decay per period (1e6)
    int32 rate, // number of purchases per period to counteract decay
    int32 max, // total quantity to be auctioned
    uint256 startTs // target start time of the auction
  ) public onlyAdmin(components) returns (uint256) {
    uint256 id = LibAuctionRegistry.get(components, itemIndex);
    require(id == 0, "auction already exists");

    require(priceTarget > 0, "price target must be positive");
    require(period > 0, "period must be positive");
    require(decay > 0 && decay < 1e6, "decay must be between 0 and 1");
    require(rate > 0, "rate must be positive");
    require(max > 0, "max must be positive");
    require(LibItem.getByIndex(components, itemIndex) != 0, "auction item does not exist");
    require(LibItem.getByIndex(components, payItemIndex) != 0, "auction pay item does not exist");

    Params memory params = Params(
      itemIndex,
      payItemIndex,
      priceTarget,
      period,
      decay,
      rate,
      max,
      startTs
    );
    return LibAuctionRegistry.create(components, params);
  }

  // remove an auction
  function remove(uint32 itemIndex) public onlyAdmin(components) {
    uint256 id = LibAuctionRegistry.get(components, itemIndex);
    require(id != 0, "AuctionRegistry: auction does not exist");
    LibAuctionRegistry.remove(components, id);
  }

  // set the window the chain was halted, so GDA pricing skips it. (0, 0) clears it.
  // pauseStart: last block timestamp before the halt. pauseEnd: first block timestamp after.
  // one window per auction: setting again replaces it
  function setPause(
    uint32 itemIndex,
    uint64 pauseStart,
    uint64 pauseEnd
  ) public onlyAdmin(components) {
    uint256 id = LibAuctionRegistry.get(components, itemIndex);
    require(id != 0, "AuctionRegistry: auction does not exist");
    if (pauseStart != 0 || pauseEnd != 0) {
      require(pauseStart < pauseEnd, "AuctionRegistry: pause must end after it starts");
      require(pauseEnd <= block.timestamp, "AuctionRegistry: pause has not ended");
      uint256 startTs = LibAuctionRegistry.getStartTs(components, id);
      require(pauseStart >= startTs, "AuctionRegistry: pause starts before the auction");
    }
    LibAuctionRegistry.setPause(components, id, pauseStart, pauseEnd);
  }

  // add a requirement to participate in an auction
  function addRequirement(
    uint32 itemIndex, // index of the item being auctioned
    string memory reqType,
    string memory logicType,
    uint32 index,
    uint256 value,
    string memory condFor
  ) public onlyAdmin(components) {
    uint256 id = LibAuctionRegistry.get(components, itemIndex);
    require(id != 0, "AuctionBuy: auction does not exist");
    LibAuctionRegistry.addRequirement(
      world,
      components,
      id,
      Condition(reqType, logicType, index, value, condFor)
    );
  }

  function execute(bytes memory arguments) public onlyAdmin(components) returns (bytes memory) {
    require(false, "not implemented");
  }
}
