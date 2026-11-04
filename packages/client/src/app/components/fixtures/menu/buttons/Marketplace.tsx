import { IconListButton } from 'app/components/library';
import { useVisibility } from 'app/stores';
import { KamiSendIcon, LpFountainIcon, MarketplaceIcon, TradeIcon } from 'assets/images/icons/menu';
import { ItemImages } from 'assets/images/items';

export const TradingMenuButton = () => {
  const { modals, setModals } = useVisibility();

  // KamiSwap takes the screen: opening it closes the modals it would cover
  const toggleKamiSwap = () => {
    const open = !modals.marketplace;
    const covered = open ? { crafting: false, trading: false, inventory: false } : {};
    setModals({ ...modals, ...covered, marketplace: open });
  };

  return (
    <IconListButton
      img={TradeIcon}
      options={[
        {
          text: 'KamiSwap',
          image: MarketplaceIcon,
          onClick: toggleKamiSwap,
        },
        {
          text: 'Kamigotchi World Order Book',
          image: TradeIcon,
          onClick: () => setModals({ ...modals, trading: !modals.trading }),
        },
        {
          text: 'KamiSend',
          image: KamiSendIcon,
          onClick: () => setModals({ ...modals, kamiSend: !modals.kamiSend }),
        },
        {
          text: 'Item Pools',
          image: LpFountainIcon,
          onClick: () => setModals({ ...modals, pool: !modals.pool }),
        },
        {
          text: 'VIP Voting & Ballots',
          image: ItemImages.golden_box,
          onClick: () => setModals({ ...modals, vip: !modals.vip }),
        },
      ]}
      maxHeight={80} // option rows scale with width: room for all of them on wide screens
      scale={4.5}
      scaleOrientation='vh'
      radius={0.9}
      tooltip={{ text: ['Trading'] }}
    />
  );
};
