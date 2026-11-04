import { AbiCoder, id } from 'ethers';

import type { RevealBase } from './kamidenHandler';

// IEmitter.WorldEvent(string indexed identifier, uint8[] schema, bytes value), as LibDroptable emits it
const WORLD_EVENT = id('WorldEvent(string,uint8[],bytes)');
const DROPTABLE_REVEAL = id('DROPTABLE_REVEAL');
const REVEAL_TYPES = ['uint256', 'uint256', 'uint256', 'uint256', 'uint32[]', 'uint256[]'];

type Log = { topics: readonly string[]; data: string };

// a reveal tx's DROPTABLE_REVEAL events, in the shape the kamiden feed delivers them
export const parseRevealReceipt = (receipt?: { logs?: readonly Log[] }): RevealBase[] => {
  const coder = AbiCoder.defaultAbiCoder();
  return (receipt?.logs ?? [])
    .filter(
      (log) =>
        log.topics[0]?.toLowerCase() === WORLD_EVENT &&
        log.topics[1]?.toLowerCase() === DROPTABLE_REVEAL
    )
    .map((log) => {
      const [, value] = coder.decode(['uint8[]', 'bytes'], log.data);
      const [commitID, holderID, , timestamp, indices, amounts] = coder.decode(REVEAL_TYPES, value);
      return {
        CommitID: commitID.toString(),
        HolderID: holderID.toString(),
        ItemIndices: [...indices].map(Number),
        ItemAmounts: [...amounts].map((a: bigint) => a.toString()),
        Timestamp: Number(timestamp),
      };
    });
};
