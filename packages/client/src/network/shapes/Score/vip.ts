import { World } from 'engine/recs';
import { Components } from 'network/components';
import { getConfigFieldValueArray } from '../Config';

// VIP_STAGE: [start, epoch length], hardcoded fallbacks fix race condition loads
const getStageInfo = (world: World, comps: Components) => {
  const stageInfo = getConfigFieldValueArray(world, comps, 'VIP_STAGE');
  return { start: stageInfo[0] || 1745481600, duration: stageInfo[1] || 1209600 };
};

// get the current vip epoch
export const getEpoch = (world: World, comps: Components): number => {
  const now = Date.now() / 1000;
  const { start, duration } = getStageInfo(world, comps);
  return Math.floor((now - start) / duration + 1);
};

// unix seconds when the current vip epoch ends
export const getEpochEnd = (world: World, comps: Components): number => {
  const { start, duration } = getStageInfo(world, comps);
  return start + getEpoch(world, comps) * duration;
};
