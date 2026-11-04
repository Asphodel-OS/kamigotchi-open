import styled from 'styled-components';

import { TextTooltip } from 'app/components/library';
import { ItemImages } from 'assets/images/items';
import { playClick } from 'utils/sounds';

export type TabKey =
  | 'all'
  | 'food'
  | 'potion'
  | 'spellcard'
  | 'consumable'
  | 'lootbox'
  | 'material'
  | 'equipment'
  | 'keyitem'
  | 'misc';

interface Tab {
  key: TabKey;
  label: string;
  types: string[];
  icon: string;
  color: string;
}

// one tab per family of item types; misc catches any type not listed
export const INVENTORY_TABS: Tab[] = [
  {
    key: 'all',
    label: 'All items',
    types: [],
    icon: ItemImages.kamigotchi_world_citizen_giftbox,
    color: '#6fbbff',
  },
  {
    key: 'food',
    label: 'Food',
    types: ['FOOD'],
    icon: ItemImages.pom_pom_fruit_candy,
    color: '#fbeebb',
  },
  {
    key: 'potion',
    label: 'Potions',
    types: ['POTION'],
    icon: ItemImages.pale_potion,
    color: '#e6dcff',
  },
  {
    key: 'spellcard',
    label: 'Spell Cards',
    types: ['SPELL CARD'],
    icon: ItemImages.cultivation_i_spell_card,
    color: '#f9e0f4',
  },
  {
    key: 'consumable',
    label: 'Consumables',
    types: ['CONSUMABLE'],
    icon: ItemImages.energy_drink,
    color: '#c9ecd3',
  },
  {
    key: 'material',
    label: 'Materials',
    types: ['MATERIAL'],
    icon: ItemImages.scrap_metal,
    color: '#e1efff',
  },
  {
    key: 'lootbox',
    label: 'Boxes',
    types: ['LOOTBOX'],
    icon: ItemImages.golden_box,
    color: '#f3dde2',
  },
  {
    key: 'equipment',
    label: 'Equipment',
    types: ['EQUIPMENT'],
    icon: ItemImages.ancient_ledger,
    color: '#ffe0c2',
  },
  {
    key: 'keyitem',
    label: 'Key items',
    types: ['KEY ITEM', 'TOOL', 'NFT'],
    icon: ItemImages.kw_maps_data_chip,
    color: '#dff5f2',
  },
  { key: 'misc', label: 'Misc', types: [], icon: ItemImages.gacha_ticket, color: '#efeee9' },
];

// the all tab stays tinted while idle, deeper when selected
const ALL_IDLE_COLOR = '#bfe0ff';

export const tabOf = (type: string): TabKey =>
  INVENTORY_TABS.find((tab) => tab.types.includes(type))?.key ?? 'misc';

export const TypeTabs = ({
  tab,
  counts,
  setTab,
}: {
  tab: TabKey;
  counts: Record<TabKey, number>;
  setTab: (tab: TabKey) => void;
}) => {
  const select = (key: TabKey) => {
    if (key === tab) return;
    playClick();
    setTab(key);
  };

  return (
    <Strip>
      {INVENTORY_TABS.map(({ key, label, icon, color }) => (
        <TextTooltip key={key} text={[label]} direction='row'>
          <Tab
            $color={tab === key ? color : key === 'all' ? ALL_IDLE_COLOR : 'white'}
            $active={tab === key}
            disabled={tab === key}
            onClick={() => select(key)}
          >
            <Icon src={icon} style={{ opacity: counts[key] === 0 && tab !== key ? 0.4 : 1 }} />
          </Tab>
        </TextTooltip>
      ))}
    </Strip>
  );
};

// the quests tab bar turned on its side: its own scroll, one rule against the items
const Strip = styled.div`
  flex: none;
  height: 100%;
  overflow-y: auto;
  background-color: white;
  border-right: solid grey 0.15vw;

  display: flex;
  flex-flow: column nowrap;

  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Tab = styled.button<{ $color: string; $active: boolean }>`
  flex: none;
  width: 3.5vw;
  height: 3.5vw;
  border: none;
  border-bottom: solid grey 0.15vw;
  background-color: ${({ $color }) => $color};

  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    background-color: ${({ $active, $color }) => ($active ? $color : '#ddd')};
  }
  &:disabled {
    cursor: default;
    pointer-events: none;
  }
`;

const Icon = styled.img`
  width: 2.2vw;
  height: 2.2vw;
  image-rendering: pixelated;
  pointer-events: none;
`;
