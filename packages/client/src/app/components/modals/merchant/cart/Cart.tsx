import { playClick } from 'utils/sounds';
import { Empty, List, Panel, PanelCount, PanelTitle } from '../styles';
import { CartItem, ItemUtils } from '../types';
import { getCartTotals } from '../utils';
import { CartRow } from './CartRow';
import { Checkout } from './Checkout';

export const Cart = ({
  cart,
  setCart,
  getBalance,
  buy,
  utils,
}: {
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  getBalance: (itemIndex: number) => number;
  buy: (cart: CartItem[]) => void;
  utils: ItemUtils;
}) => {
  const totals = getCartTotals(cart, getBalance);

  const setQuantity = (itemIndex: number, quantity: number) =>
    setCart(cart.map((c) => (c.listing.item.index === itemIndex ? { ...c, quantity } : c)));

  const remove = (itemIndex: number) => {
    playClick();
    setCart(cart.filter((c) => c.listing.item.index !== itemIndex));
  };

  const handleBuy = () => {
    playClick();
    buy(cart);
    setCart([]);
  };

  return (
    <Panel $width='38%' $divider>
      <PanelTitle>
        Cart
        {cart.length > 0 && (
          <PanelCount>{`${cart.length} item${cart.length === 1 ? '' : 's'}`}</PanelCount>
        )}
      </PanelTitle>
      {cart.length === 0 ? (
        <Empty>Your cart is empty.</Empty>
      ) : (
        <>
          <List>
            {cart.map((c) => (
              <CartRow
                key={c.listing.item.index}
                listing={c.listing}
                currencyBalance={getBalance(c.listing.payItem.index)}
                quantity={c.quantity}
                setQuantity={(quantity) => setQuantity(c.listing.item.index, quantity)}
                remove={() => remove(c.listing.item.index)}
                utils={utils}
              />
            ))}
          </List>
          <Checkout totals={totals} buy={handleBuy} />
        </>
      )}
    </Panel>
  );
};
