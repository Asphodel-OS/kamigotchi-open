import { NpcImages } from 'assets/images/npcs';
import { objectMinaRed } from 'assets/images/rooms/13_giftshop';
import { NPC } from 'network/shapes/Npc';

interface MerchantLook {
  image: string;
  height: number; // vw
  title?: string;
  tagline: string;
}

// how each merchant presents its shop, keyed by npc index
const Looks: Record<number, MerchantLook> = {
  1: { image: objectMinaRed, height: 8, tagline: 'Buy something or get out.' },
  2: {
    image: NpcImages['vend.png'],
    height: 8,
    title: 'Vending Machine',
    tagline: "Some people say it's not real food!",
  },
  10: {
    image: NpcImages['alaina_shop.png'],
    height: 8.3,
    tagline: 'Gifts from the fire, for the ones who look after this world.',
  },
};

export const getMerchantLook = (npc: NPC) => {
  const look = Looks[npc.index];
  return {
    image: look?.image,
    height: look?.height ?? 8,
    title: look?.title ?? `${npc.name}'s Shop`,
    tagline: look?.tagline ?? '',
  };
};
