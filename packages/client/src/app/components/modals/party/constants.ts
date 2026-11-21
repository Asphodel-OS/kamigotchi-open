import { CollectIcon, LiquidateIcon } from 'assets/images/icons/actions';
import { KamiIcon } from 'assets/images/icons/menu';
import { StatusIcons } from 'assets/images/icons/statuses';
import { TraitIcons } from 'assets/images/icons/traits';
import { TriggerIcons } from 'assets/images/icons/triggers';
import { StatIcons } from 'constants/stats';
import { Sort, View } from './types';

export const SortIcons: Record<Sort, string> = {
  name: KamiIcon,
  state: StatIcons.health,
  traits: TraitIcons.hand,
  'harvest rate': CollectIcon,
  strain: LiquidateIcon,
  'resting rate': StatusIcons.resting_healrate,
};

export const ViewIcons: Record<View, string> = {
  collapsed: TriggerIcons.eyeHalf,
  expanded: TriggerIcons.eyeOpen,
  external: TriggerIcons.eyeClosed,
};

// most kamis one transaction takes. the harvest sizes keep it under about 9M gas:
// the rpc cannot estimate a transaction above about 10M
export const BatchLimits = { add: 8, collect: 5, stop: 5, stake: 12 };
