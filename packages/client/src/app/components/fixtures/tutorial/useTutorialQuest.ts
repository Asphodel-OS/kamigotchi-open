import { hasComponent } from 'engine/recs';
import { useEffect, useState } from 'react';

import { useLayers } from 'app/root/hooks';
import { NetworkLayer } from 'network/';
import { Account, getAccount, queryAccountFromEmbedded } from 'network/shapes/Account';
import {
  checkQuestObjective,
  getQuest,
  getQuestByIndex,
  queryQuestInstance,
} from 'network/shapes/Quest';

// One shared watcher for every tutorial, instead of a timer per tutorial. It only looks at
// the quests tutorials ask about, and only those that exist on this world: on a world without
// them (main has no demo quests, the test world may not have main's) nothing is polled.
const ACTIVE_POLL_MS = 1000; // a tutorial is guiding the player: keep up with each step
const IDLE_POLL_MS = 5000; // waiting for a quest to be accepted
// also covers the first moments after load, before the world's quest data has synced
const EXISTS_RECHECK_MS = 15_000;

export type TutorialQuest = { index: number; objectivesMet: boolean };
type Snapshot = ReadonlyMap<number, TutorialQuest>;

let network: NetworkLayer | undefined;
const watched = new Map<number, number>(); // quest index -> number of tutorials watching it
let existing: number[] = [];
let existsCheckedAt = 0;
let snapshot: Snapshot = new Map();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

const schedule = (ms: number) => {
  clearTimeout(timer);
  timer = watched.size ? setTimeout(poll, ms) : undefined;
};

const sameSnapshot = (a: Snapshot, b: Snapshot) =>
  a.size === b.size && [...a].every(([i, q]) => b.get(i)?.objectivesMet === q.objectivesMet);

const poll = () => {
  if (!network || !watched.size) return;
  if (document.hidden) return schedule(IDLE_POLL_MS); // nobody to guide
  const { world, components } = network;

  const now = Date.now();
  if (now - existsCheckedAt > EXISTS_RECHECK_MS) {
    existing = [...watched.keys()].filter((i) => !!getQuestByIndex(world, components, i));
    existsCheckedAt = now;
  }
  if (!existing.length) {
    if (snapshot.size) {
      snapshot = new Map();
      listeners.forEach((listener) => listener());
    }
    return schedule(EXISTS_RECHECK_MS);
  }

  const next = new Map<number, TutorialQuest>();
  const accountEntity = queryAccountFromEmbedded(network);
  if (accountEntity) {
    let account: Account | undefined;
    for (const index of existing) {
      // direct lookup of the player's copy of the quest, not a scan of all their quests
      const instance = queryQuestInstance(world, index, accountEntity);
      if (!instance || hasComponent(components.IsComplete, instance)) continue;
      const player = (account ??= getAccount(world, components, accountEntity));
      const quest = getQuest(world, components, instance);
      const objectivesMet = quest.objectives.every(
        (objective) => checkQuestObjective(world, components, objective, quest, player).completable
      );
      next.set(index, { index, objectivesMet });
    }
  }
  if (!sameSnapshot(snapshot, next)) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }
  schedule(next.size ? ACTIVE_POLL_MS : IDLE_POLL_MS);
};

const onVisible = () => {
  if (!document.hidden) poll(); // catch up as soon as the player comes back
};

const watch = (layer: NetworkLayer, indices: number[]) => {
  network = layer;
  if (!watched.size) document.addEventListener('visibilitychange', onVisible);
  indices.forEach((i) => watched.set(i, (watched.get(i) ?? 0) + 1));
  existsCheckedAt = 0;
  poll();
  return () => {
    indices.forEach((i) => {
      const count = (watched.get(i) ?? 1) - 1;
      count ? watched.set(i, count) : watched.delete(i);
    });
    existsCheckedAt = 0;
    if (!watched.size) {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
};

// the first of these quests the player has accepted and not completed, if any.
// pass the same indices on every render (a module-level constant)
export const useTutorialQuest = (indices: readonly number[]): TutorialQuest | undefined => {
  const { network: layer } = useLayers();
  const key = indices.join(',');
  const [current, setCurrent] = useState<Snapshot>(snapshot);
  useEffect(() => {
    const listener = () => setCurrent(snapshot);
    listeners.add(listener);
    const unwatch = watch(layer, [...indices]);
    setCurrent(snapshot);
    return () => {
      listeners.delete(listener);
      unwatch();
    };
  }, [layer, key]);
  for (const index of indices) {
    const quest = current.get(index);
    if (quest) return quest;
  }
};
