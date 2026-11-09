import { EntityIndex, World } from 'engine/recs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Components } from 'network/';
import { NullNode } from 'network/shapes/Node/constants';

// the node shape and the component read are stubbed: the cache logic is what is under test
const chain = vi.hoisted(() => ({ raw: undefined as string | undefined, isNode: true }));
const packed = (k: number) => String(k); // K as LibNode stores it
vi.mock('network/shapes/utils/component', () => ({ getHarvestMultiplier: () => chain.raw }));
vi.mock('network/shapes/Node', async () => {
  const { NullNode } = await vi.importActual<typeof import('network/shapes/Node/constants')>(
    'network/shapes/Node/constants'
  );
  return {
    NullNode,
    queryNodeByIndex: () => undefined,
    getNode: (_w: unknown, _c: unknown, entity: EntityIndex) =>
      chain.isNode ? { ...NullNode, entity, index: 7, name: 'Node 7' } : NullNode,
  };
});

import { NodeCache, get } from './base';

const world = {} as World;
const components = {} as Components;

describe('node cache multiplier', () => {
  beforeEach(() => {
    NodeCache.clear();
    chain.raw = packed(1000);
    chain.isNode = true;
  });

  it('keeps the same node while K is unchanged', () => {
    const a = get(world, components, 1 as EntityIndex);
    const b = get(world, components, 1 as EntityIndex);
    expect(a.multiplier).toBe(1000);
    expect(b).toBe(a);
  });

  it('replaces the node when K changes, leaving the old one as it was', () => {
    const before = get(world, components, 1 as EntityIndex);
    chain.raw = packed(2500);
    const after = get(world, components, 1 as EntityIndex);
    expect(after).not.toBe(before);
    expect(after.multiplier).toBe(2500);
    expect(before.multiplier).toBe(1000);
    expect(get(world, components, 1 as EntityIndex)).toBe(after);
  });

  it('never writes a multiplier onto the shared NullNode', () => {
    chain.isNode = false;
    chain.raw = packed(5000);
    const node = get(world, components, 2 as EntityIndex);
    expect(node).toBe(NullNode);
    expect(NullNode.multiplier).toBe(1000);
  });
});
