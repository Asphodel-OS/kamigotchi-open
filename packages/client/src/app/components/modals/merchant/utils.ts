import { calcBuyPrice } from 'app/cache/npc/calcs';
import { Item } from 'network/shapes/Item';
import { Listing } from 'network/shapes/Listing';
import { CartItem } from './types';

export interface CurrencyTotal {
  currency: Item;
  amount: number;
  balance: number;
}

export const CART_MIN = 1;
export const CART_MAX = 100;

// the currencies a merchant takes, in listing order
export const getCurrencies = (listings: Listing[]): Item[] => {
  const byIndex = new Map<number, Item>();
  for (const { payItem } of listings) {
    if (!byIndex.has(payItem.index)) byIndex.set(payItem.index, payItem);
  }
  return [...byIndex.values()];
};

// cart cost per currency: one buy charges each listing in its own currency
export const getCartTotals = (
  cart: CartItem[],
  getBalance: (itemIndex: number) => number
): CurrencyTotal[] => {
  const byIndex = new Map<number, CurrencyTotal>();
  for (const { listing, quantity } of cart) {
    const currency = listing.payItem;
    const total = byIndex.get(currency.index) ?? {
      currency,
      amount: 0,
      balance: getBalance(currency.index),
    };
    total.amount += calcBuyPrice(listing, quantity);
    byIndex.set(currency.index, total);
  }
  return [...byIndex.values()];
};

export const isShort = (total: CurrencyTotal) => total.amount > total.balance;

export const clampQuantity = (quantity: number) =>
  Math.max(CART_MIN, Math.min(CART_MAX, Math.floor(quantity) || CART_MIN));

export const formatAmount = (amount: number) => amount.toLocaleString('en-US');
