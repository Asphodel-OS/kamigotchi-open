import { EntityIndex } from 'engine/recs';
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { Inventory } from 'app/cache/inventory';
import { EmptyText, ItemTooltip } from 'app/components/library';
import { ButtonListOption, IconListButton } from 'app/components/library/buttons';
import { MUSU_INDEX, VIPP_INDEX } from 'constants/items';
import { Account } from 'network/shapes/Account';
import { Allo } from 'network/shapes/Allo';
import { Item } from 'network/shapes/Item';
import { Kami } from 'network/shapes/Kami';
import { DetailedEntity } from 'network/shapes/utils';
import { Mode } from '../types';
import { INVENTORY_TABS, TabKey, tabOf, TypeTabs } from './TypeTabs';
import { UseAmountOption } from './UseAmountOption';

const EMPTY_TEXT = ['Inventory is empty.', 'Be less poore..'];
const EMPTY_TAB_TEXT = ['Nothing of this kind.'];
const EMPTY_SEARCH_TEXT = ['No item by that name.'];

// get the row of consumable items to display in the player inventory
export const ItemGrid = ({
  actions,
  data,
  state,
  utils,
}: {
  actions: {
    useForAccount: (item: Item, amount: number) => void;
    useForKami: (kami: Kami, item: Item) => void;
  };
  data: {
    account: Account;
    accountEntity: EntityIndex;
    inventories: Inventory[];
    kamis: Kami[];
  };
  state: {
    mode: Mode;
    tab: TabKey;
    setTab: (tab: TabKey) => void;
    query: string;
    setQuery: (query: string) => void;
  };
  utils: {
    displayRequirements: (item: Item) => string;
    meetsRequirements: (holder: Kami | Account, item: Item) => boolean;
    parseAllos: (allo: Allo[]) => DetailedEntity[];
  };
}) => {
  const { useForAccount, useForKami } = actions;
  const { account, inventories, kamis } = data;
  const { mode, tab, setTab, query, setQuery } = state;
  const needle = query.trim().toLowerCase();
  const { meetsRequirements } = utils;

  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState<Inventory[]>([]);

  // hide ItemGrid when sendView is true
  useEffect(() => {
    const id = setTimeout(() => setVisible(mode === 'STOCK'), 200);
    return () => clearTimeout(id);
  }, [mode]);

  // musu lives in the footer; everything else is bucketed by type
  const owned = useMemo(
    () => inventories.filter((inv) => inv.item.index !== MUSU_INDEX),
    [inventories]
  );

  const counts = useMemo(() => {
    const counts = Object.fromEntries(INVENTORY_TABS.map((t) => [t.key, 0])) as Record<
      TabKey,
      number
    >;
    for (const inv of owned) counts[tabOf(inv.item.type)]++;
    counts.all = owned.length;
    return counts;
  }, [owned]);

  // set displayed when the inventory, the tab or the search changes
  useEffect(() => {
    if (needle) setDisplayed(owned.filter((inv) => inv.item.name.toLowerCase().includes(needle)));
    else setDisplayed(tab === 'all' ? owned : owned.filter((inv) => tabOf(inv.item.type) === tab));
  }, [owned, tab, needle]);

  // a search spans every item, so the strip shows all items; picking a tab ends the search
  const selectTab = (next: TabKey) => {
    if (needle) setQuery('');
    setTab(next);
  };

  /////////////////
  // INTERPRETATION

  // get the usage options for a given item
  const getItemActions = (item: Item, bal: number): ButtonListOption[] => {
    if (!item.for) return [];
    if (item.for === 'KAMI') return getKamiOptions(item);
    if (item.for === 'ACCOUNT') return getAccountOptions(item, bal);
    return [];
  };

  // get the list of options for Kami to use Item on
  const getKamiOptions = (item: Item): ButtonListOption[] => {
    const available = kamis.filter((kami) => meetsRequirements(kami, item));
    return available.map((kami) => ({
      text: kami.name,
      image: kami.image,
      onClick: () => useForKami(kami, item),
    }));
  };

  // Use All is reserved for VIPP - every other Account item uses the quantity row
  const getAccountOptions = (item: Item, bal: number): ButtonListOption[] => {
    if (bal < 2 || item.index !== VIPP_INDEX) return [];
    if (!meetsRequirements(account, item)) return [];
    return [{ text: 'Use All', onClick: () => useForAccount(item, bal) }];
  };

  // the batch-use quantity row, pinned above the options of an Account item
  const getQuantityRow = (item: Item, bal: number) => {
    if (item.for !== 'ACCOUNT' || bal < 1) return undefined;
    if (!meetsRequirements(account, item)) return undefined;
    return <UseAmountOption max={bal} onSubmit={(amt) => useForAccount(item, amt)} />;
  };

  /////////////////
  // RENDER

  return (
    <Container isVisible={visible} key='grid'>
      <TypeTabs tab={needle ? 'all' : tab} counts={counts} setTab={selectTab} />
      <Items>
        {displayed.length < 1 && (
          <Empty>
            <EmptyText
              text={owned.length < 1 ? EMPTY_TEXT : needle ? EMPTY_SEARCH_TEXT : EMPTY_TAB_TEXT}
            />
          </Empty>
        )}
        {displayed.length > 0 && (
          <Grid>
            {displayed.map((inv) => {
              const item = inv.item;
              const options = getItemActions(item, inv.balance);
              const quantityRow = getQuantityRow(item, inv.balance);

              return (
                <ItemWrapper key={item.index}>
                  <IconListButton
                    key={item.index}
                    img={item.image}
                    scale={5}
                    balance={inv.balance}
                    options={options}
                    topContent={quantityRow}
                    disabled={(options.length == 0 && !quantityRow) || item.is.disabled}
                    tooltip={{
                      text: [<ItemTooltip key={item.index} item={item} utils={utils} />],
                      maxWidth: 25,
                    }}
                  />
                </ItemWrapper>
              );
            })}
          </Grid>
        )}
      </Items>
    </Container>
  );
};

// the strip and the items scroll on their own; the modal body itself never has to
const Container = styled.div<{ isVisible: boolean }>`
  ${({ isVisible }) => (isVisible ? `display: flex; ` : `display: none;`)}
  flex: 1 1 auto;
  min-height: 0;
  flex-flow: row nowrap;
  align-items: stretch;
`;

const Items = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;

  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, auto);
  justify-content: center;
  gap: 0.45vw;
  padding: 0.6vw;
`;

const Empty = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  padding-top: 2.6vw;
`;

const ItemWrapper = styled.div`
  position: relative;
`;
