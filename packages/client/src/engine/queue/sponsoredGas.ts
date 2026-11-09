// Wallet pairs the gas sponsor server has confirmed are on Yominet's fee whitelist. Only their
// wallets' transactions go at gas price 0: anyone else, such as a player who funded their own
// wallet instead, still pays as usual, since the chain rejects a zero fee from them.
// Kept per pair, not per address: hidden screens can check different operators for the same
// owner, and a "none" for one pair must not clear an owner another pair confirmed.
const pairs = new Map<string, [string, string]>();

export const setSponsoredPair = (owner: string, operator: string, isSponsored: boolean) => {
  const pair: [string, string] = [owner.toLowerCase(), operator.toLowerCase()];
  const key = pair.join(':');
  if (isSponsored) pairs.set(key, pair);
  else pairs.delete(key);
};

export const isSponsoredWallet = (address?: string) => {
  if (!address) return false;
  const wallet = address.toLowerCase();
  for (const pair of pairs.values()) if (pair.includes(wallet)) return true;
  return false;
};
