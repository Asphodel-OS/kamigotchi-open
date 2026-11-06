import { isAddress, JsonRpcProvider, parseEther, toQuantity } from 'ethers';

const LOCAL_PLAYER_ETH = '10';

export const setAutoMine = async (on: boolean) => {
  if (process.env.NODE_ENV !== 'local') return;
  console.log(`** Setting automine to ${on} **`);
  const provider = new JsonRpcProvider(process.env.RPC!);
  await provider.send(`${on ? 'anvil_setAutomine' : 'evm_setIntervalMining'}`, [on ? true : 1]);
};

export const setTimestamp = async (ts: number = Math.floor(Date.now() / 1000)) => {
  if (process.env.NODE_ENV !== 'local') return;
  console.log(`** Setting timestamp to ${ts} **`);
  const provider = new JsonRpcProvider(process.env.RPC!);
  await provider.send('evm_setNextBlockTimestamp', [ts]);
};

// run before deploying, so a typo fails right away rather than after a long deploy
export const assertLocalPlayerWallet = () => {
  if (process.env.NODE_ENV !== 'local') return;
  const wallet = process.env.LOCAL_PLAYER_WALLET;
  if (wallet && !isAddress(wallet)) {
    throw new Error(`LOCAL_PLAYER_WALLET is not a valid address: ${wallet}`);
  }
};

// funds LOCAL_PLAYER_WALLET, since a fresh local chain starts every other wallet at 0
export const fundLocalPlayer = async () => {
  if (process.env.NODE_ENV !== 'local') return;
  const wallet = process.env.LOCAL_PLAYER_WALLET;
  if (!wallet) return;
  console.log(`** Funding ${wallet} with ${LOCAL_PLAYER_ETH} ETH **`);
  const provider = new JsonRpcProvider(process.env.RPC!);
  await provider.send('anvil_setBalance', [wallet, toQuantity(parseEther(LOCAL_PLAYER_ETH))]);
};
