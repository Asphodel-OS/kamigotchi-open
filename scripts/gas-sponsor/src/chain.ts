import {
  AccAddress,
  Fee,
  isTxError,
  MsgAddFeeWhitelistAddresses,
  MsgExecuteMessages,
  MsgRemoveFeeWhitelistAddresses,
  MsgSend,
  RawKey,
  RESTClient,
  Wallet,
} from '@initia/initia.js';

const FREE_LANE_GAS_LIMIT = 4_500_000;
const GAS_ADJUSTMENT = 1.5;
const DUST_AMOUNT = '1'; // 1 wei is enough for the chain to know the address

export interface ChainConfig {
  restUrl: string;
  chainId: string;
  privateKey: string;
  dustDenom: string;
}

export const toBech32 = (evmAddress: string) => AccAddress.fromHex(evmAddress);

export const connect = async (cfg: ChainConfig) => {
  const rest = new RESTClient(cfg.restUrl, { chainId: cfg.chainId });
  const hex = cfg.privateKey.replace(/^0x/, '');
  const key = new RawKey(Buffer.from(hex, 'hex'), true);
  const wallet = new Wallet(rest, key);
  const signer = key.accAddress;

  const authority = async (): Promise<string> => {
    const res = (await rest.apiRequester.get(
      '/cosmos/auth/v1beta1/module_accounts/opchild'
    )) as any;
    return res.account.base_account.address;
  };

  const params = () => rest.opchild.parameters();

  /** Whichever addresses in the list the chain already has on its fee whitelist. */
  const onWhitelist = async (addresses: string[]) => {
    const list = new Set((await params()).fee_whitelist);
    return new Set(addresses.filter((a) => list.has(a)));
  };

  // dust and whitelist travel in one tx, so a wallet is either fully set up or untouched
  const addMsgs = (auth: string, addresses: string[]) => [
    ...addresses.map((to) => new MsgSend(signer, to, { [cfg.dustDenom]: DUST_AMOUNT })),
    new MsgExecuteMessages(signer, [new MsgAddFeeWhitelistAddresses(auth, addresses)]),
  ];

  const removeMsgs = (auth: string, addresses: string[]) => [
    new MsgExecuteMessages(signer, [new MsgRemoveFeeWhitelistAddresses(auth, addresses)]),
  ];

  const simulate = async (msgs: any[]) => {
    const unsigned = await wallet.createTx({ msgs, fee: new Fee(FREE_LANE_GAS_LIMIT, {}) });
    const estimate = await rest.tx.estimateGas(unsigned, {
      signers: [{ publicKey: key.publicKey, sequenceNumber: await wallet.sequence() }],
      gasAdjustment: GAS_ADJUSTMENT,
    });
    const gas = Math.ceil(Number(estimate));
    if (gas > FREE_LANE_GAS_LIMIT) {
      throw new Error(`batch needs ${gas} gas, above the ${FREE_LANE_GAS_LIMIT} free lane cap`);
    }
    return gas;
  };

  const send = async (msgs: any[]) => {
    const gas = await simulate(msgs);
    const tx = await wallet.createAndSignTx({ msgs, fee: new Fee(gas, {}) });
    const res = await rest.tx.broadcast(tx);
    if (isTxError(res)) throw new Error(`tx ${res.txhash} failed: ${res.raw_log}`);
    return { txHash: res.txhash, timestamp: res.timestamp, height: res.height };
  };

  return { addMsgs, authority, onWhitelist, params, removeMsgs, send, signer, simulate };
};

export type Chain = Awaited<ReturnType<typeof connect>>;

/** Refuses to run with any key other than the chain's current admin. */
export const assertAdmin = async (chain: Chain) => {
  const { admin } = await chain.params();
  if (admin !== chain.signer) {
    throw new Error(`signer ${chain.signer} is not the opchild admin ${admin}`);
  }
};
