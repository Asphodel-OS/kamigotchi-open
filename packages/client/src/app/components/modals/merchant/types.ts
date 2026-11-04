import { Allo } from 'network/shapes/Allo';
import { Item } from 'network/shapes/Item';
import { Listing } from 'network/shapes/Listing';
import { DetailedEntity } from 'network/shapes/utils';

export interface CartItem {
  listing: Listing;
  quantity: number;
}

// what ItemTooltip needs to describe an item
export interface ItemUtils {
  parseAllos: (allo: Allo[]) => DetailedEntity[];
  displayRequirements: (item: Item) => string;
}
