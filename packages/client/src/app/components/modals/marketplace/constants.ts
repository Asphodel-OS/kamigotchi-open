export const DEFAULT_SELECTED_FILTERS = () => ({
  Face: new Set<string>(),
  Hands: new Set<string>(),
  Body: new Set<string>(),
  Color: new Set<string>(),
  Background: new Set<string>(),
});

export const DEFAULT_AFFINITY_FILTERS = (): { body: string | null; hand: string | null } => ({
  body: null,
  hand: null,
});

const STAT_FILTER_BASELINES: Record<string, number> = {
  Level: 1,
  Health: 10,
  Power: 10,
  Violence: 10,
  Harmony: 10,
  Slots: 0,
};

export const DEFAULT_STAT_FILTERS = () => ({ ...STAT_FILTER_BASELINES });

export const isStatFilterActive = (key: string, value: number) =>
  value > (STAT_FILTER_BASELINES[key] ?? 0);
