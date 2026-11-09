// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import "solecs/components/Uint256BareComponent.sol";

uint256 constant ID = uint256(keccak256("component.harvest.multiplier"));

// harvest multiplier K, per mille, in the low 16 bits. a node stores its K (LibNode.setMultiplierByIndex);
// a harvest stores the K its open stretch pays (LibHarvest.setCopy)
contract HarvestMultiplierComponent is Uint256BareComponent {
  constructor(address world) Uint256BareComponent(world, ID) {}
}
