import { useEffect, useState } from 'react';
import styled from 'styled-components';

import { getAccount as _getAccount } from 'app/cache/account';
import { getInventoryBalance } from 'app/cache/inventory';
import { cleanNPCListings, getNPCByIndex, NPC, NullNPC, refreshNPCListings } from 'app/cache/npc';
import { ModalWrapper } from 'app/components/library';
import { Palette } from 'app/components/library/pastel';
import { useLayers } from 'app/root/hooks';
import { UIComponent } from 'app/root/types';
import { useSelected, useVisibility } from 'app/stores';
import { Account, NullAccount, queryAccountFromEmbedded } from 'network/shapes/Account';
import { parseAllos as _parseAllos, Allo } from 'network/shapes/Allo';
import { parseConditionalText } from 'network/shapes/Conditional';
import { Item } from 'network/shapes/Item';
import { Listing } from 'network/shapes/Listing';
import { DetailedEntity } from 'network/shapes/utils';
import { Cart } from './cart';
import { Catalog } from './catalog';
import { Header } from './header';
import { CartItem, ItemUtils } from './types';
import { getCurrencies } from './utils';

// merchant window with listings. assumes at most 1 merchant per room
export const MerchantModal: UIComponent = {
  id: 'MerchantModal',
  Render: () => {
    const layers = useLayers();

    const {
      data: { accountEntity },
      utils: { getAccount, getNPC, cleanListings, refreshListings, itemUtils },
      network: { actions, api },
    } = (() => {
      const { network } = layers;
      const { components, world } = network;
      const accountEntity = queryAccountFromEmbedded(network);
      const itemUtils: ItemUtils = {
        parseAllos: (allo: Allo[]): DetailedEntity[] => _parseAllos(world, components, allo),
        displayRequirements: (item: Item) =>
          item?.requirements?.use
            ?.map((req) => parseConditionalText(world, components, req))
            .join('\n') || 'None',
      };

      return {
        data: { accountEntity },
        utils: {
          getAccount: () =>
            _getAccount(world, components, accountEntity, { live: 2, inventory: 2 }),
          getNPC: (index: number) => getNPCByIndex(world, components, index, { listings: 60 }),
          cleanListings: (listings: Listing[], account: Account) =>
            cleanNPCListings(world, components, listings, account),
          refreshListings: (npc: NPC) => refreshNPCListings(components, npc),
          itemUtils,
        },
        network,
      };
    })();
    const npcIndex = useSelected((s) => s.npcIndex);
    const merchantModalOpen = useVisibility((s) => s.modals.merchant);

    const [account, setAccount] = useState<Account>(NullAccount);
    const [merchant, setMerchant] = useState<NPC>(NullNPC);
    const [listings, setListings] = useState<Listing[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [lastTick, setLastTick] = useState(Date.now());

    // ticking
    useEffect(() => {
      const refreshClock = () => setLastTick(Date.now());
      const timerID = setInterval(refreshClock, 1000);
      return () => clearInterval(timerID);
    }, []);

    // refresh balances and listing prices on each tick
    useEffect(() => {
      if (!merchantModalOpen) return;
      if (!merchant || npcIndex != merchant.index) return;
      setAccount(getAccount());
      refreshListings(merchant);
    }, [lastTick]);

    // update the account whenever the entity changes
    useEffect(() => {
      setAccount(getAccount());
    }, [accountEntity]);

    // load the selected merchant, with an empty cart
    useEffect(() => {
      if (!merchantModalOpen || npcIndex == merchant.index) return;
      const newMerchant = getNPC(npcIndex) ?? NullNPC;
      setMerchant(newMerchant);
      setListings(cleanListings(newMerchant.listings, account));
      setCart([]);
    }, [merchantModalOpen, npcIndex, account]);

    const getBalance = (itemIndex: number) =>
      getInventoryBalance(account.inventories ?? [], itemIndex);

    // buy the whole cart in one tx; each listing charges its own currency
    const buy = (cart: CartItem[]) => {
      const indices = cart.map((c) => c.listing.item.index);
      const amts = cart.map((c) => c.quantity);

      actions.add({
        action: 'ListingBuy',
        params: [npcIndex, indices, amts],
        description: `Purchasing from ${merchant.name}`,
        execute: async () => {
          return api.player.npc.listing.buy(npcIndex, indices, amts);
        },
      });
    };

    /////////////////
    // DISPLAY

    return (
      <ModalWrapper id='merchant' canExit overlay>
        <Header merchant={merchant} currencies={getCurrencies(listings)} getBalance={getBalance} />
        <Body>
          <Catalog
            listings={listings}
            cart={cart}
            setCart={setCart}
            getBalance={getBalance}
            utils={itemUtils}
          />
          <Cart cart={cart} setCart={setCart} getBalance={getBalance} buy={buy} utils={itemUtils} />
        </Body>
      </ModalWrapper>
    );
  },
};

const Body = styled.div`
  margin: 0 1.2vw 1.2vw 1.2vw;
  min-height: 70%;
  display: flex;
  align-items: stretch;
  overflow: hidden;
  background: ${Palette.paper};
  border: solid ${Palette.ink} 0.15vw;
  border-radius: 0.6vw;
  user-select: none;
`;
