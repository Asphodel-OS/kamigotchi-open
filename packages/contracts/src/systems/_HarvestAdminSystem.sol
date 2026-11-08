// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { System } from "solecs/System.sol";
import { IWorld } from "solecs/interfaces/IWorld.sol";

import { LibBonus } from "libraries/LibBonus.sol";
import { LibExperience } from "libraries/LibExperience.sol";
import { LibHarvest } from "libraries/LibHarvest.sol";
import { MUSU_INDEX } from "libraries/LibInventory.sol";
import { LibKami } from "libraries/LibKami.sol";
import { LibNode } from "libraries/LibNode.sol";
import { LibScore } from "libraries/LibScore.sol";
import { AuthRoles } from "libraries/utils/AuthRoles.sol";

uint256 constant ID = uint256(keccak256("system.harvest.admin"));

// admin controls for harvest operations
contract _HarvestAdminSystem is System, AuthRoles {
  constructor(IWorld _world, address _components) System(_world, _components) {}

  // index is kami index
  function stop(uint32 index) public onlyAdmin(components) returns (bytes memory) {
    uint256 kamiID = LibKami.genID(index);
    uint256 id = LibKami.getHarvest(components, kamiID); // harvest ID

    LibHarvest.verifyIsHarvest(components, id);
    LibKami.verifyState(components, kamiID, "HARVESTING");
    LibKami.sync(components, kamiID);
    _stop(id, kamiID);
    return "";
  }

  // naive batched execution - todo: optimize
  function stopBatched(
    uint32[] memory indices // kami indices
  ) public onlyAdmin(components) {
    for (uint256 i; i < indices.length; i++) stop(indices[i]);
  }

  ////////////////
  // INTERNALS

  // stops the harvest the same way a player stop does, on the owner's behalf: the owner gets the
  // harvested MUSU, XP, scavenge points, scores and harvest time logs
  function _stop(uint256 harvestID, uint256 kamiID) internal {
    uint256 accID = LibKami.getAccount(components, kamiID); // the kami's owner, not the admin
    uint256 output = LibHarvest.claim(components, harvestID, accID);
    LibHarvest.stop(components, harvestID, kamiID);
    LibKami.setState(components, kamiID, "RESTING");
    LibExperience.inc(components, kamiID, output);
    LibKami.resetCooldown(components, kamiID);
    LibBonus.resetUponCooldownSet(components, kamiID);

    // scavenge
    uint256 nodeID = LibHarvest.getNode(components, harvestID);
    uint32 nodeIndex = LibNode.getIndex(components, nodeID);
    LibNode.scavenge(components, nodeIndex, output, accID);

    // reset action bonuses
    LibBonus.resetUponHarvestStop(components, kamiID);

    // standard logging and tracking
    LibScore.incFor(components, accID, MUSU_INDEX, "COLLECT", output);
    LibHarvest.logHarvestTimes(components, accID, nodeIndex, harvestID);
    LibHarvest.logAmounts(
      components,
      accID,
      nodeIndex,
      LibNode.getAffinity(components, nodeID),
      MUSU_INDEX,
      output
    );
    LibHarvest.emitLog(world, "HARVEST_STOP", accID, kamiID, nodeIndex, output);
  }

  function execute(bytes memory arguments) public onlyAdmin(components) returns (bytes memory) {
    require(false, "not implemented");
    return "";
  }
}
