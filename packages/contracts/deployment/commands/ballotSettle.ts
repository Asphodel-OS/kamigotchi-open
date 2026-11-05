// Settles closed Initia VIP gauge cycles/epochs into Ballots on Yominet.
// Reads every Yominet voter off L1, keeps EVM wallets (the only ones that can own an account),
// and reports each one's Yominet power, with the cycle/epoch's eligible weight, to
// BallotSettleSystem as the BALLOT_REPORTER. Before sending, every settle already on chain is
// checked against L1, so a settle made with the reporter key anywhere else fails the run.
// Each run re-checks the last LOOKBACK closed cycles/epochs, oldest first, so voters who
// register an account after their cycle/epoch closed are still paid and streaks settle in order.
//
//   NODE_ENV=local ts-node deployment/commands/ballotSettle.ts              # dry run, recent ones
//   NODE_ENV=local ts-node deployment/commands/ballotSettle.ts --cycle 38 --send
//   NODE_ENV=local ts-node deployment/commands/ballotSettle.ts --cycle 38 --accept-gap --send
//   NODE_ENV=local ts-node deployment/commands/ballotSettle.ts --reset-lock 38 --send   # owner
//
// --send signs with BALLOT_REPORTER_KEY (--reset-lock: PRIV_KEY, the world owner). Safe to re-run:
// settled voters are skipped.
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

import { WorldAddresses } from '../utils/addresses';
import { getProvider } from '../utils/chain';

const argv = require('yargs/yargs')(require('yargs/helpers').hideBin(process.argv))
  .option('cycle', { type: 'number', describe: 'one gauge cycle (default: recent closed ones)' })
  .option('send', { type: 'boolean', default: false, describe: 'send settles (default: dry run)' })
  .option('accept-gap', {
    type: 'boolean',
    default: false,
    describe: "with --cycle: settle even if vip-api's list misses part of L1's tally",
  })
  .option('reset-lock', { type: 'number', describe: "owner only: clear a cycle's locked weight" })
  .help().argv;

const LCD = process.env.INITIA_LCD || 'https://rest.initia.xyz';
const VIP_API = process.env.INITIA_VIP_API || 'https://vip-api.initia.xyz';
const VIP = '0x3a886b32a802582f2e446e74d4a24d1d7ed01adf46d2a8f65c5723887e708789';
const BRIDGE = '11'; // yominet
const ONE = 10n ** 18n; // BigDecimal scale
const LOOKBACK = 6; // closed cycles/epochs re-checked each run, within LibBallot's SETTLE_WINDOW
const RETRIES = 3; // L1's LCD and vip-api answer 502 now and then
const CONCURRENCY = 8; // reads in flight at once
const MIN_BALANCE = ethers.parseEther('0.001'); // reporter ETH; each settle costs ~0.000001
const CACHE_DIR = process.env.BALLOTS_CACHE_DIR || path.join(__dirname, '../../.ballots-cache');
const SETTLE_ABI = [
  'function executeTyped(address owner, uint64 cycle, uint256 yominetPower, uint256 eligibleWeight, bool streakVote) returns (bytes)',
  'function resetLock(uint64 cycle)',
];
const VALUE_ABI = ['function safeGet(uint256) view returns (uint256)'];

type Vote = { address: string; power: bigint; weight: bigint };

// runs fn over items with at most `limit` calls in flight, keeping order
const mapLimit = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) => {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
};

/////////////////
// L1

const getJson = async (url: string, init?: RequestInit) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`${url}: ${res.status} ${await res.text()}`);
      return await res.json();
    } catch (e) {
      if (attempt >= RETRIES) throw e;
      await new Promise((resolve) => setTimeout(resolve, 5_000 * attempt));
    }
  }
};

// weight_vote views; args are JSON-encoded strings
const view = async (fn: string, args: (string | number)[]) => {
  const body = await getJson(`${LCD}/initia/move/v1/view/json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      address: VIP,
      module_name: 'weight_vote',
      function_name: fn,
      type_args: [],
      args: args.map((a) => JSON.stringify(String(a))),
    }),
  });
  return JSON.parse(body.data);
};

// bech32 -> bytes (no checksum check: addresses come from Initia's own API)
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const bech32Bytes = (addr: string): Uint8Array => {
  const data = addr.slice(addr.lastIndexOf('1') + 1, -6);
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (const c of data) {
    acc = (acc << 5) | CHARSET.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
};

// "1", "0.25" -> scaled by 1e18
const toScaled = (dec: string) => {
  const [i, f = ''] = dec.split('.');
  return BigInt(i) * ONE + BigInt((f + '0'.repeat(18)).slice(0, 18));
};

// every yominet voter of a cycle/epoch per vip-api, as raw address bytes, once each. vaults and
// objects (Cabal) are 32 bytes; only 20-byte EVM wallets can own an account
const getVoters = async (cycle: number): Promise<Uint8Array[]> => {
  const out = new Map<string, Uint8Array>();
  const seen = new Set<string>();
  let listed = 0;
  let key = '';
  do {
    const page = await getJson(
      `${VIP_API}/analytics/votes/${BRIDGE}/${cycle}` + (key ? `?pagination.key=${key}` : '')
    );
    for (const v of page.votes) {
      const bytes = bech32Bytes(v.address);
      out.set(ethers.hexlify(bytes), bytes);
      listed++;
    }
    key = page.pagination?.next_key ? encodeURIComponent(page.pagination.next_key) : '';
    if (seen.has(key)) throw new Error(`vip-api repeated pagination key for cycle ${cycle}`);
    seen.add(key);
  } while (key);
  if (listed > out.size)
    console.log(`cycle ${cycle}: dropped ${listed - out.size} duplicate voters`);
  return [...out.values()];
};

// the voter's final vote, the source of truth: max_voting_power is their whole power when they
// voted, and L1 tallies weight x max_voting_power, truncated (voting_power is only the allocated part).
// L1 doesn't dedupe bridge ids and tallies each entry on its own, so sum every yominet entry
const getYominetVote = async (cycle: number, bytes: Uint8Array) => {
  const padded = '0x' + ethers.hexlify(bytes).slice(2).padStart(64, '0');
  const res = await view('get_weight_vote', [cycle, padded]);
  if (res.max_voting_power === undefined) throw new Error('get_weight_vote: no max_voting_power');
  const mvp = BigInt(res.max_voting_power);
  let power = 0n;
  let weight = 0n;
  for (const w of res.weights.filter((x: any) => x.bridge_id === BRIDGE)) {
    const scaled = toScaled(w.weight);
    power += (mvp * scaled) / ONE;
    weight += scaled;
  }
  return { power, weight };
};

const getL1Tally = async (cycle: number) => {
  const tallies = await view('get_tally_infos', [cycle]);
  return BigInt(tallies.find((t: any) => t.bridge_id === BRIDGE)?.tally ?? 0);
};

// closed cycles/epochs never change on L1, so their votes are cached once they match L1's tally
const cachePath = (cycle: number) => path.join(CACHE_DIR, `cycle-${cycle}.json`);
const readCache = (cycle: number): Vote[] | undefined => {
  if (!fs.existsSync(cachePath(cycle))) return undefined;
  return JSON.parse(fs.readFileSync(cachePath(cycle), 'utf8')).map((v: any) => ({
    address: v.address,
    power: BigInt(v.power),
    weight: BigInt(v.weight),
  }));
};
const writeCache = (cycle: number, votes: Vote[]) => {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const rows = votes.map((v) => ({ ...v, power: String(v.power), weight: String(v.weight) }));
  fs.writeFileSync(cachePath(cycle), JSON.stringify(rows));
};

// a cycle/epoch's yominet votes. vip-api's list must account for L1's whole yominet tally, else
// someone is missing and the eligible weight the first settle locks would be wrong for good
const getCycleVotes = async (cycle: number): Promise<Vote[] | undefined> => {
  const cached = readCache(cycle);
  if (cached) return cached;
  const voters = await getVoters(cycle);
  const votes = await mapLimit(voters, CONCURRENCY, async (bytes) => ({
    address: ethers.hexlify(bytes),
    ...(await getYominetVote(cycle, bytes)),
  }));
  const listed = votes.reduce((sum, v) => sum + v.power, 0n);
  const l1Tally = await getL1Tally(cycle);
  if (listed === l1Tally) {
    writeCache(cycle, votes);
    return votes;
  }
  console.log(`cycle ${cycle}: voter list covers ${listed} of L1's ${l1Tally} uinit`);
  if (argv.acceptGap && argv.cycle === cycle) return votes; // settled by hand, never cached
  return undefined;
};

/////////////////
// YOMINET

// LibData.getID(holder, index, type) and LibConfig.genID(name)
const dataID = (holder: string | number, index: number, type: string) =>
  ethers.solidityPackedKeccak256(
    ['string', 'uint256', 'uint32', 'string'],
    ['is.data', holder, index, type]
  );
const configID = (name: string) =>
  ethers.solidityPackedKeccak256(['string', 'string'], ['is.config', name]);

// LibPack uint32[8]: element 0 sits in the top 32 bits
const unpackU32 = (packed: bigint, i: number) =>
  Number((packed >> BigInt(32 * (7 - i))) & 0xffffffffn);

// LibBallot.calcWeight: uinit -> millionths of a Ballot, 1 Ballot per divN INIT within each band.
// must match the contract exactly, or the first settle locks a weight later settles can't meet
const calcWeight = (t: number[], power: bigint) => {
  let w = 0n;
  let lo = 0n;
  for (let i = 0; i < 4 && power > lo; i++) {
    const hi = i < 3 ? BigInt(t[i]) * 1_000_000n : power;
    w += ((power < hi ? power : hi) - lo) / BigInt(t[3 + i]);
    lo = hi;
  }
  return w;
};

// yominet's rpc puts the revert reason only in the error message (no revert data), so ethers'
// reason is empty there: read the rpc message too
const revertText = (e: any): string =>
  String(
    e?.reason ?? e?.info?.error?.message ?? e?.error?.message ?? e?.shortMessage ?? e?.message
  );

/////////////////
// MAIN

const main = async () => {
  const now = Math.floor(Date.now() / 1000);
  const addrs = new WorldAddresses();
  await addrs.init();
  const sysAddr = (await addrs.getSysAddr('system.ballot.settle'))!;
  if (BigInt(sysAddr) === 0n) throw new Error('BallotSettleSystem is not deployed on this world');
  const provider = getProvider();
  const values = new ethers.Contract(
    (await addrs.getCompAddr('component.value'))!,
    VALUE_ABI,
    provider
  );
  const read = (holder: string | number, index: number, type: string): Promise<bigint> =>
    values.safeGet(dataID(holder, index, type));
  // after a send errors: is the owner's settle on chain at this power? a pending tx gets a few tries
  const landed = async (owner: string, cycle: number, power: bigint) => {
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5_000 * attempt));
      try {
        const record = await read(owner, cycle, 'BALLOT_POWER');
        if (record === power) return true;
        if (record > 0n) return false; // settled at another power: the after-send check flags it
      } catch {} // rpc still down: try again
    }
    return false;
  };

  if (argv.resetLock) {
    const cycle = argv.resetLock;
    const locked = await read(0, cycle, 'BALLOT_ELIGIBLE_WEIGHT');
    console.log(`cycle ${cycle}: locked eligible weight ${ethers.formatUnits(locked, 6)}`);
    if (!argv.send) return console.log('dry run: --send clears it with PRIV_KEY');
    const owner = new ethers.Wallet(process.env.PRIV_KEY!, provider);
    const tx = await new ethers.Contract(sysAddr, SETTLE_ABI, owner).resetLock(cycle);
    await tx.wait();
    return console.log(`cleared (${tx.hash}); the next run locks it again`);
  }
  if (argv.acceptGap && !argv.cycle) throw new Error('--accept-gap needs --cycle');

  const key = process.env.BALLOT_REPORTER_KEY;
  if (argv.send && !key) throw new Error('--send needs BALLOT_REPORTER_KEY');
  const reporter = argv.send ? new ethers.Wallet(key!, provider) : null;
  // a dry run with the key still checks it, so CI can test the key without sending
  const raw = key ? new ethers.Wallet(key).address : process.env.BALLOT_REPORTER;
  if (!raw) throw new Error('set BALLOT_REPORTER (dry run) or BALLOT_REPORTER_KEY (--send)');
  const from = ethers.getAddress(raw); // checksummed, to compare with the one on chain
  const onChain = ethers.getAddress(
    ethers.toBeHex(await values.safeGet(configID('BALLOT_REPORTER')), 20)
  );
  if (onChain !== from) throw new Error(`BALLOT_REPORTER on chain is ${onChain}, not ${from}`);
  const system = new ethers.Contract(sysAddr, SETTLE_ABI, reporter ?? provider);

  let failed = 0;
  // settles cost gas: warn while there's still some left, not once it's empty
  const balance = await provider.getBalance(from);
  console.log(`reporter ${from}: ${ethers.formatEther(balance)} ETH`);
  if (balance < MIN_BALANCE) {
    console.log(`reporter balance under ${ethers.formatEther(MIN_BALANCE)} ETH: top it up`);
    failed++;
  }

  // BALLOT_CYCLE [start, length, launch]: cycles/epochs before launch never settle
  const launch = unpackU32(await values.safeGet(configID('BALLOT_CYCLE')), 2);
  if (!launch) throw new Error('BALLOT_CYCLE is not configured on this world');
  const packedTiers: bigint = await values.safeGet(configID('BALLOT_TIERS'));
  const tiers = [...Array(8).keys()].map((i) => unpackU32(packedTiers, i));
  if (tiers.slice(3, 7).some((d) => !d)) throw new Error('BALLOT_TIERS is not configured');
  const packedRates: bigint = await values.safeGet(configID('BALLOT_RATES'));
  const rates = [...Array(8).keys()].map((i) => unpackU32(packedRates, i));
  // BALLOT_RATES[4]: least yominet share (bps) that builds the streak; unset means 100%
  const streakMin = BigInt(rates[4] || 10_000);
  const streakPower = BigInt(Math.max(rates[5], tiers[7])) * 1_000_000n;
  // under floorMin a voter earns 0 Ballots and no streak: settling them only spends our gas
  const dustPower = BigInt(tiers[7]) * 1_000_000n;

  // closed cycles/epochs, oldest first. L1 opens them lazily, so the stored one may be closed too
  const store = await view('get_module_store', []);
  const current = Number(store.current_cycle);
  const cycles: number[] = [];
  for (const c of argv.cycle
    ? [argv.cycle]
    : [...Array(LOOKBACK + 1).keys()].map((i) => current - LOOKBACK + i)) {
    if (c < launch || c < 1) continue;
    const proposal = await view('get_proposal', [c]);
    if (Number(proposal.voting_end_time) < now) cycles.push(c);
    else if (argv.cycle) throw new Error(`cycle ${c} voting is still open`);
  }

  // the cycle/epoch's settles on yominet must be exactly the listed voters (each one's power is
  // checked against L1 below). the settled weight is not recomputed: the tiers may have changed
  // since the cycle settled, and the contract derives it from the checked powers anyway
  const matchesChain = async (cycle: number, settled: { power: bigint }[]) =>
    (await read(0, cycle, 'BALLOT_VOTERS')) === BigInt(settled.length);

  let totalSent = 0;
  // owners whose settle failed unexpectedly wait for the next run: settling their later
  // cycles/epochs first would lock in a broken streak
  const held = new Set<string>();
  for (const cycle of cycles) {
    const votes = await getCycleVotes(cycle);
    if (!votes) {
      failed++;
      break; // later cycles/epochs wait, so streaks still settle in order
    }

    // biggest first: floors are paid on top of the pool split while it lasts, so they come last
    const live = votes
      .filter((v) => v.address.length === 42 && v.power > 0n)
      .map((v) => ({
        owner: ethers.getAddress(v.address),
        power: v.power,
        streakVote: v.weight * 10_000n >= streakMin * ONE,
      }))
      .sort((a, b) => (b.power > a.power ? 1 : b.power < a.power ? -1 : 0));
    const tally = live.reduce((sum, v) => sum + v.power, 0n);
    const eligible = live.reduce((sum, v) => sum + calcWeight(tiers, v.power), 0n);
    const locked = await read(0, cycle, 'BALLOT_ELIGIBLE_WEIGHT');
    console.log(
      `cycle ${cycle}: ${live.length} wallet voters, ${ethers.formatUnits(tally, 6)} INIT, ` +
        `eligible weight ${ethers.formatUnits(eligible, 6)}` +
        (locked ? ` (locked ${ethers.formatUnits(locked, 6)})` : '')
    );
    if (locked && locked !== eligible) {
      console.log(
        `cycle ${cycle}: eligible weight differs from the one locked on yominet, not settling ` +
          `(--reset-lock ${cycle} recovers it)`
      );
      failed++;
      break; // later cycles/epochs wait, so streaks still settle in order
    }

    // a settle at another power, or for an account L1 doesn't list, means the reporter key
    // was used outside this job
    const records = await mapLimit(live, CONCURRENCY, (v) => read(v.owner, cycle, 'BALLOT_POWER'));
    const settled = live.filter((_, i) => records[i] > 0n);
    const forged = live.filter((v, i) => records[i] > 0n && records[i] !== v.power);
    for (const v of forged) {
      console.log(
        `  mismatch     ${v.owner}: settled at ${records[live.indexOf(v)]}, L1 ${v.power}`
      );
    }
    if (forged.length || !(await matchesChain(cycle, settled))) {
      console.log(`cycle ${cycle}: settles on yominet don't match L1, not settling: check the key`);
      failed++;
      break;
    }

    // simulate the rest first: owners with no account are skipped without spending gas
    // dust stays in the eligible weight (it's locked from every voter), it just isn't sent
    const dust = live.filter((v, i) => records[i] === 0n && v.power < dustPower);
    if (dust.length)
      console.log(`  dust         ${dust.length} voters under ${tiers[7]} INIT, not settled`);
    const todo = live.filter(
      (v, i) => records[i] === 0n && v.power >= dustPower && !held.has(v.owner)
    );
    for (const v of live) if (held.has(v.owner)) console.log(`  held         ${v.owner}`);
    const sims = await mapLimit(todo, CONCURRENCY, async (v) => {
      try {
        const args = [v.owner, cycle, v.power, eligible, v.streakVote] as const;
        const ret = await system.executeTyped.staticCall(...args, { from });
        return { ballots: ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], ret)[0] };
      } catch (e: any) {
        return { error: revertText(e) };
      }
    });

    const EXPECTED = /no account detected|already settled/;
    let sent = 0;
    for (let i = 0; i < todo.length; i++) {
      const v = todo[i];
      const label = `${v.owner} ${ethers.formatUnits(v.power, 6).padStart(16)} INIT${v.streakVote ? ' streak' : ''}`;
      const sim = sims[i];
      if (sim.error !== undefined) {
        if (!EXPECTED.test(sim.error)) {
          failed++;
          held.add(v.owner);
        }
        if (!EXPECTED.test(sim.error) || argv.cycle)
          console.log(`  skip         ${label}: ${sim.error}`);
        continue;
      }
      if (!reporter) {
        console.log(`  would settle ${label} -> ${sim.ballots} ballots`);
        continue;
      }
      try {
        const tx = await system.executeTyped(v.owner, cycle, v.power, eligible, v.streakVote);
        await tx.wait();
        sent++;
        settled.push(v);
        console.log(`  settled      ${label} -> ${sim.ballots} ballots (${tx.hash})`);
      } catch (e: any) {
        // the rpc can drop the connection after the tx went out (ECONNRESET): if the settle
        // landed anyway, count it, or the after-send check sees one more on chain and fails the run
        if (await landed(v.owner, cycle, v.power)) {
          sent++;
          settled.push(v);
          console.log(
            `  settled      ${label} -> ${sim.ballots} ballots (landed despite: ${revertText(e)})`
          );
          continue;
        }
        failed++;
        held.add(v.owner);
        console.log(`  skip         ${label}: ${revertText(e)}`);
      }
    }
    if (reporter) {
      console.log(`  sent ${sent}`);
      totalSent += sent;
      if (!(await matchesChain(cycle, settled))) {
        console.log(
          `cycle ${cycle}: settles on yominet don't match L1 after sending: check the key`
        );
        failed++;
        break;
      }
    }

    // streak voters by size, to spot many small wallets building streaks at once
    const streakers = live.filter((v) => v.streakVote && v.power >= streakPower);
    const band = (lo: bigint, hi: bigint) =>
      streakers.filter((v) => v.power >= lo * 1_000_000n && v.power < hi * 1_000_000n).length;
    const golden = await read(0, cycle, 'BALLOT_CYCLE_GOLDEN');
    console.log(
      `  streak votes: ${band(0n, 1_000n)} under 1k INIT, ${band(1_000n, 10_000n)} 1k-10k, ` +
        `${band(10_000n, 10n ** 30n)} over 10k; golden ballots owed ${golden}`
    );
  }
  // the workflow posts this to discord, so a job that quietly stopped running gets noticed
  if (process.env.GITHUB_OUTPUT)
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `sent=${totalSent}\n`);
  // anything else (checks, reporter not set, out of gas, rpc down) fails the run so the cron alerts
  if (failed) throw new Error(`${failed} settles or checks failed unexpectedly`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
