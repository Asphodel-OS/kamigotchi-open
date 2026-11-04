// Initia L1 reads/writes for the Yominet gauge vote. views go through the LCD's JSON view
// endpoint; the vote is a MsgExecute of weight_vote::vote, signed via InterwovenKit. Ballots
// are settled after the cycle/epoch closes by the reporter (deployment/commands/ballotSettle.ts)

export const L1_LCD_URL = import.meta.env.VITE_INITIA_LCD_URL || 'https://rest.initia.xyz';
export const WEIGHT_VOTE_ADDRESS =
  '0x3a886b32a802582f2e446e74d4a24d1d7ed01adf46d2a8f65c5723887e708789';
export const YOMINET_BRIDGE_ID = 11;
export const VOTING_POWER_DECIMALS = 1e6; // voting power is reported in uinit-scale units

export interface GaugeCycle {
  cycle: number;
  start: number; // unix seconds
  end: number;
  votingEnd: number; // votes close a little before the cycle/epoch ends
}

export interface WeightVote {
  votingPower: number; // raw L1 units, the voter's whole power when the vote was cast
  yominetWeight: number; // 0..1
  yominetPower: number; // raw L1 units, what L1 tallies for Yominet
  voted: boolean;
}

/////////////////
// VIEWS

// POST /initia/move/v1/view/json: args are JSON-encoded strings, the result is a JSON string
const view = async <T>(fn: string, args: (string | number)[] = []): Promise<T> => {
  const res = await fetch(`${L1_LCD_URL}/initia/move/v1/view/json`, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      address: WEIGHT_VOTE_ADDRESS,
      module_name: 'weight_vote',
      function_name: fn,
      type_args: [],
      args: args.map((a) => JSON.stringify(String(a))),
    }),
  });
  const body = await res.json();
  if (!res.ok || body.data === undefined) throw new Error(body.message ?? `view ${fn} failed`);
  return JSON.parse(body.data) as T;
};

// L1 opens a cycle/epoch lazily, on its first vote, so the stored one can be past its end: the
// next is then current_cycle + 1 from the latest boundary, as weight_vote::create_proposal does
export const getGaugeCycle = async (): Promise<GaugeCycle> => {
  const store = await view<Record<string, string>>('get_module_store');
  const now = Math.floor(Date.now() / 1000);
  const interval = Number(store.cycle_interval);
  let cycle = Number(store.current_cycle);
  let start = Number(store.cycle_start_time);
  let end = Number(store.cycle_end_time);
  if (now > end) {
    cycle += 1;
    start = end + Math.floor((now - end) / interval) * interval;
    end = start + interval;
  }
  return { cycle, start, end, votingEnd: start + Number(store.voting_period) };
};

export const getVotingPower = async (address: string) =>
  Number(await view<string>('get_voting_power', [address]));

// BigDecimal string ("0.25") to 1e18 fixed point
const toWad = (dec: string) => {
  const [i, f = ''] = dec.split('.');
  return BigInt(i) * 10n ** 18n + BigInt((f + '0'.repeat(18)).slice(0, 18));
};

const NO_VOTE: WeightVote = { votingPower: 0, yominetWeight: 0, yominetPower: 0, voted: false };

// max_voting_power is the voter's whole power when they voted (the vote keeps it until they vote
// again); voting_power is only the part allocated. L1 tallies weight x max_voting_power, truncated,
// once per entry: bridge ids aren't deduped, so every yominet entry counts, as the reporter sums them
export const getWeightVote = async (cycle: number, address: string): Promise<WeightVote> => {
  let res: { max_voting_power: string; weights: { bridge_id: string; weight: string }[] };
  try {
    res = await view('get_weight_vote', [cycle, address]);
  } catch (e) {
    // L1 opens a cycle/epoch on its first vote; until then there's nothing to read
    const store = await view<Record<string, string>>('get_module_store');
    if (cycle > Number(store.current_cycle)) return NO_VOTE;
    throw e;
  }
  const maxPower = BigInt(res.max_voting_power);
  const yominet = res.weights.filter((w) => Number(w.bridge_id) === YOMINET_BRIDGE_ID);
  const wads = yominet.map((w) => toWad(w.weight));
  const weight = wads.reduce((sum, w) => sum + w, 0n);
  return {
    votingPower: Number(maxPower),
    yominetWeight: Number(weight) / 1e18,
    yominetPower: Number(wads.reduce((sum, w) => sum + (maxPower * w) / 10n ** 18n, 0n)),
    voted: res.weights.length > 0,
  };
};

/////////////////
// TXS

// bcs u64: 8 bytes, little endian
const u64 = (n: number) => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(n), true);
  return bytes;
};

// bcs vector<u64> [11]
const YOMINET_ONLY = Uint8Array.from([1, ...u64(YOMINET_BRIDGE_ID)]);
// bcs vector<BigDecimal> [1.0]: BigDecimal is a BigUint of 1e18, as little-endian bytes
const FULL_WEIGHT = Uint8Array.from([1, 8, 0x00, 0x00, 0x64, 0xa7, 0xb3, 0xb6, 0xe0, 0x0d]);

// weight_vote::vote(cycle, [11], [1.0]): 100% of the signer's voting power to Yominet
export const buildVoteMsg = (sender: string, cycle: number) => ({
  typeUrl: '/initia.move.v1.MsgExecute',
  value: {
    sender,
    moduleAddress: WEIGHT_VOTE_ADDRESS,
    moduleName: 'weight_vote',
    functionName: 'vote',
    typeArgs: [],
    args: [u64(cycle), YOMINET_ONLY, FULL_WEIGHT],
  },
});
