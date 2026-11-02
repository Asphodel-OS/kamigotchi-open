// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import "solecs/components/Uint256BareComponent.sol";

uint256 constant ID = uint256(keccak256("component.time.pause"));

// a packed pause window (uint64 start << 64 | uint64 end), eg. while the chain was halted
contract TimePauseComponent is Uint256BareComponent {
  constructor(address world) Uint256BareComponent(world, ID) {}
}
