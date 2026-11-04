// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { System } from "solecs/System.sol";
import { IWorld } from "solecs/interfaces/IWorld.sol";

import { LibAccount } from "libraries/LibAccount.sol";
import { LibBallot } from "libraries/LibBallot.sol";

uint256 constant ID = uint256(keccak256("system.ballot.claim"));

// BallotClaimSystem mints the caller's owed Ballots and milestone rewards from settled
// cycles/epochs
contract BallotClaimSystem is System {
  constructor(IWorld _world, address _components) System(_world, _components) {}

  function execute(bytes memory) public returns (bytes memory) {
    uint256 accID = LibAccount.getByOwnerOrOperator(components, msg.sender);

    (uint256 ballots, uint256 golden, uint256 badges) = LibBallot.claim(components, accID);

    LibBallot.logClaim(world, accID, ballots, golden, badges);
    LibAccount.updateLastTs(components, accID);
    return abi.encode(ballots);
  }

  function executeTyped() public returns (bytes memory) {
    return execute("");
  }
}
