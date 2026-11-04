// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { System } from "solecs/System.sol";
import { IWorld } from "solecs/interfaces/IWorld.sol";

import { LibAccount } from "libraries/LibAccount.sol";
import { LibBallot } from "libraries/LibBallot.sol";
import { LibConfig } from "libraries/LibConfig.sol";

uint256 constant ID = uint256(keccak256("system.ballot.settle"));

// BallotSettleSystem is called by the ballot reporter (deployment/commands/ballotSettle.ts), which reads
// each voter's final yominet vote for a closed gauge cycle/epoch off Initia L1 (weight_vote views).
// Ballots are owed, minted when the account claims (BallotClaimSystem)
contract BallotSettleSystem is System {
  constructor(IWorld _world, address _components) System(_world, _components) {}

  function execute(bytes memory arguments) public returns (bytes memory) {
    require(
      msg.sender == LibConfig.getAddress(components, "BALLOT_REPORTER"),
      "Ballot: not reporter"
    );
    (address owner, uint64 cycle, uint256 power, uint256 eligible, bool streakVote) = abi.decode(
      arguments,
      (address, uint64, uint256, uint256, bool)
    );
    uint256 accID = LibAccount.getByOwner(components, owner);

    (uint256 ballots, uint256 streak) = LibBallot.settle(
      components,
      accID,
      cycle,
      power,
      eligible,
      streakVote
    );

    LibBallot.logSettle(world, accID, cycle, power, ballots, streak);
    return abi.encode(ballots);
  }

  function executeTyped(
    address owner,
    uint64 cycle,
    uint256 yominetPower,
    uint256 eligibleWeight,
    bool streakVote
  ) public returns (bytes memory) {
    return execute(abi.encode(owner, cycle, yominetPower, eligibleWeight, streakVote));
  }

  /// @notice owner-only recovery: clears a cycle/epoch's locked eligible weight so the reporter
  /// can settle it again after the lock stopped matching (deployment/commands/ballotSettle.ts)
  function resetLock(uint64 cycle) public onlyOwner {
    LibBallot.resetLock(components, cycle);
  }
}
