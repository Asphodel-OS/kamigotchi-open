// Operator commands, run by hand. `report` needs no key; `remove` needs the signer key.
import { assertAdmin, connect, toBech32 } from './chain.ts';
import { addedAddresses, openDb } from './db.ts';

const BATCH_PLAYERS = 50;

const flag = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : (process.argv[i + 1] ?? '');
};

const db = openDb(process.env.DB_PATH ?? './sponsor.db');
const command = process.argv[2];

if (command === 'report') {
  const cols = [
    'owner_address',
    'operator_address',
    'status',
    'requested_at',
    'whitelisted_at',
    'tx_hash',
    'removed_at',
    'removal_tx_hash',
  ] as const;
  console.log(cols.join(','));
  for (const row of db.reportRows()) console.log(cols.map((c) => row[c] ?? '').join(','));
} else if (command === 'remove') {
  // only touches addresses this server added, never the chain's other whitelist entries,
  // including ones that were already on it when a player was granted
  const before = flag('--before');
  if (!before && !process.argv.includes('--all')) {
    throw new Error('pass --all or --before <ISO time>');
  }
  const rows = db.removable(before);
  console.log(`${rows.length} players to remove`);
  if (rows.length && process.argv.includes('--confirm')) {
    const chain = await connect({
      restUrl: process.env.REST_URL!,
      chainId: process.env.CHAIN_ID!,
      privateKey: process.env.SIGNER_PRIVATE_KEY!,
      dustDenom: process.env.DUST_DENOM!,
    });
    await assertAdmin(chain);
    const authority = await chain.authority();
    for (let i = 0; i < rows.length; i += BATCH_PLAYERS) {
      const batch = rows.slice(i, i + BATCH_PLAYERS);
      const ours = batch.flatMap((r) => addedAddresses(r).map(toBech32));
      const onChain = await chain.onWhitelist(ours); // failed rows may never have landed
      const addresses = ours.filter((a) => onChain.has(a));
      const txHash = addresses.length
        ? (await chain.send(chain.removeMsgs(authority, addresses))).txHash
        : 'none-on-chain';
      db.markRemoved(
        batch.map((r) => r.id),
        txHash
      );
      console.log(`removed ${batch.length} players in ${txHash}`);
    }
  } else if (rows.length) {
    console.log('nothing sent: add --confirm to remove them');
  }
} else {
  throw new Error('usage: manage.ts report | remove (--all | --before <ISO time>) [--confirm]');
}
