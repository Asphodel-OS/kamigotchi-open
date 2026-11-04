import { Listing } from 'network/shapes/Listing';
import { Empty, List, Panel, PanelTitle } from '../styles';
import { CartItem, ItemUtils } from '../types';
import { CatalogRow } from './CatalogRow';

export const Catalog = ({
  listings,
  cart,
  setCart,
  getBalance,
  utils,
}: {
  listings: Listing[];
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  getBalance: (itemIndex: number) => number;
  utils: ItemUtils;
}) => {
  const isInCart = (listing: Listing) =>
    cart.some((c) => c.listing.item.index === listing.item.index);

  const toggle = (listing: Listing) => {
    if (isInCart(listing)) {
      setCart(cart.filter((c) => c.listing.item.index !== listing.item.index));
    } else {
      setCart([...cart, { listing, quantity: 1 }]);
    }
  };

  return (
    <Panel $width='62%'>
      <PanelTitle>Catalog</PanelTitle>
      {listings.length === 0 ? (
        <Empty>Nothing for sale right now.</Empty>
      ) : (
        <List>
          {listings.map((listing) => (
            <CatalogRow
              key={listing.entity}
              listing={listing}
              owned={getBalance(listing.item.index)}
              currencyBalance={getBalance(listing.payItem.index)}
              inCart={isInCart(listing)}
              toggle={() => toggle(listing)}
              utils={utils}
            />
          ))}
        </List>
      )}
    </Panel>
  );
};
