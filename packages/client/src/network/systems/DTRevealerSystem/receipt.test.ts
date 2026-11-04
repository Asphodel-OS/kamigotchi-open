import { AbiCoder, id } from 'ethers';
import { describe, expect, it } from 'vitest';

import { parseRevealReceipt } from './receipt';

const coder = AbiCoder.defaultAbiCoder();
const WORLD_EVENT = id('WorldEvent(string,uint8[],bytes)');

const worldEventLog = (identifier: string, value: string) => ({
  topics: [WORLD_EVENT, id(identifier)],
  data: coder.encode(['uint8[]', 'bytes'], [[13, 13, 13, 13, 0, 0], value]),
});

describe('parseRevealReceipt', () => {
  it('reads DROPTABLE_REVEAL events in the kamiden feed shape', () => {
    const value = coder.encode(
      ['uint256', 'uint256', 'uint256', 'uint256', 'uint32[]', 'uint256[]'],
      [7n, 42n, 9n, 1793044526n, [21004, 11110], [5n, 0n]]
    );
    const reveals = parseRevealReceipt({
      logs: [worldEventLog('DROPTABLE_REVEAL', value), worldEventLog('OTHER_EVENT', value)],
    });
    expect(reveals).toEqual([
      {
        CommitID: '7',
        HolderID: '42',
        ItemIndices: [21004, 11110],
        ItemAmounts: ['5', '0'],
        Timestamp: 1793044526,
      },
    ]);
  });

  it('returns nothing without a receipt', () => {
    expect(parseRevealReceipt(undefined)).toEqual([]);
  });
});
