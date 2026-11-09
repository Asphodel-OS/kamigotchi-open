// Holds the admin key. Opens no ports: it only reads requests from the database.
import { assertAdmin, connect, toBech32, type Chain } from './chain.ts';
import { openDb, type Db, type Sponsorship } from './db.ts';

const POLL_MS = 3_000;
const BATCH_PLAYERS = 10;

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`missing env var ${name}`);
  return value;
};

const walletsOf = (row: Sponsorship) => [
  toBech32(row.owner_address),
  toBech32(row.operator_address),
];

export const processBatch = async (db: Db, chain: Chain, authority: string) => {
  const rows = db.pending(BATCH_PLAYERS);
  if (!rows.length) return 0;

  const onChain = await chain.onWhitelist(rows.flatMap(walletsOf));
  // record which addresses are ours to add before sending anything, so a crash or a failed
  // confirmation later can't make an address we added look like one that was already there
  for (const row of rows) {
    const [owner, operator] = walletsOf(row);
    db.setAdded(row.id, !onChain.has(owner), !onChain.has(operator));
  }

  // already fully on the whitelist: either it was before, or an earlier send landed
  const isDone = (row: Sponsorship) => walletsOf(row).every((a) => onChain.has(a));
  const done = rows.filter(isDone);
  if (done.length)
    db.markWhitelisted(
      done.map((r) => r.id),
      null
    );

  const todo = rows.filter((row) => !isDone(row));
  if (!todo.length) return done.length;

  // dust and whitelist only the addresses that aren't on it yet
  const missing = todo.flatMap(walletsOf).filter((a) => !onChain.has(a));
  let result;
  try {
    result = await chain.send(chain.addMsgs(authority, missing));
  } catch (e: any) {
    // the grant itself failed. removal still checks failed rows, in case it landed anyway
    db.markFailed(
      todo.map((r) => r.id),
      String(e?.response?.data?.message ?? e?.message ?? e)
    );
    console.error(`batch failed: ${e?.message ?? e}`);
    return done.length;
  }

  let confirmed: Set<string>;
  try {
    confirmed = await chain.onWhitelist(todo.flatMap(walletsOf));
  } catch (e: any) {
    // the grant was sent but couldn't be checked: leave the rows pending, and the next loop
    // finds them on the whitelist and records them
    console.error(`sent ${result.txHash}, confirmation failed, will recheck: ${e?.message ?? e}`);
    return done.length;
  }
  const good = todo.filter((row) => walletsOf(row).every((a) => confirmed.has(a)));
  db.markWhitelisted(
    good.map((r) => r.id),
    result.txHash,
    new Date(result.timestamp).toISOString()
  );
  const bad = todo.filter((row) => !good.includes(row));
  if (bad.length)
    db.markFailed(
      bad.map((r) => r.id),
      `not on whitelist after ${result.txHash}`
    );
  console.log(`whitelisted ${good.length} players in ${result.txHash}`);
  return done.length + good.length;
};

const main = async () => {
  const chain = await connect({
    restUrl: required('REST_URL'),
    chainId: required('CHAIN_ID'),
    privateKey: required('SIGNER_PRIVATE_KEY'),
    dustDenom: required('DUST_DENOM'),
  });
  await assertAdmin(chain);
  const authority = await chain.authority();
  console.log(`signer ${chain.signer} is the chain admin`);

  if (process.argv.includes('--dry-run')) {
    // simulates only: nothing is broadcast
    const sample = [chain.signer];
    const gas = await chain.simulate(chain.addMsgs(authority, sample));
    console.log(`dry run ok: one address needs ${gas} gas including the safety margin`);
    return;
  }

  const db = openDb(required('DB_PATH'));
  for (;;) {
    try {
      await processBatch(db, chain, authority);
    } catch (e: any) {
      console.error(`signer loop: ${e?.message ?? e}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e?.message ?? e);
    process.exit(1);
  });
}
