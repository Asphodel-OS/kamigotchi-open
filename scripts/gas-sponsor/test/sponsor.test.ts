import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import type { IncomingMessage } from 'node:http';

import { clientIp, createApi, createRateLimiter, isEvmAddress, walletsMatch } from '../src/api.ts';
import { toBech32, type Chain } from '../src/chain.ts';
import { addedAddresses, openDb } from '../src/db.ts';
import { processBatch } from '../src/signer.ts';

const ORIGIN = 'https://demo.kamigotchi.io';
const OWNER = '0x' + 'a'.repeat(40);
const OPERATOR = '0x' + 'b'.repeat(40);
const linked = [
  { type: 'wallet', chainType: 'ethereum', address: OWNER, walletClientType: 'metamask' },
  { type: 'wallet', chainType: 'ethereum', address: OPERATOR, walletClientType: 'privy' },
];

test('claim is once per user and wallet, and failed grants can retry', () => {
  const db = openDb(':memory:');
  const first = db.claim('u1', OWNER, OPERATOR, null, 10);
  assert.ok(first.ok);
  assert.equal(first.row.status, 'pending');
  assert.deepEqual(db.claim('u2', OWNER, '0x' + 'c'.repeat(40), null, 10), {
    ok: false,
    reason: 'wallet_taken',
  });
  // a wallet can't be reused in the other role either
  assert.deepEqual(db.claim('u3', '0x' + 'c'.repeat(40), OWNER, null, 10), {
    ok: false,
    reason: 'wallet_taken',
  });
  db.markFailed([first.row.id], 'boom');
  const retry = db.claim('u1', OWNER, OPERATOR, null, 10);
  assert.ok(retry.ok);
  assert.equal(retry.row.status, 'pending');
  assert.equal(retry.row.error, null);
});

test('cap stops new players but not existing ones', () => {
  const db = openDb(':memory:');
  assert.ok(db.claim('u1', OWNER, OPERATOR, null, 1).ok);
  assert.deepEqual(db.claim('u2', '0x' + 'c'.repeat(40), '0x' + 'd'.repeat(40), null, 1), {
    ok: false,
    reason: 'cap_reached',
  });
  assert.ok(db.claim('u1', OWNER, OPERATOR, null, 1).ok);
});

test('records when each player was whitelisted and removed', () => {
  const db = openDb(':memory:');
  const claim = db.claim('u1', OWNER, OPERATOR, '1.2.3.4', 10);
  assert.ok(claim.ok);
  db.markWhitelisted([claim.row.id], 'HASH', '2026-11-06T00:00:00.000Z');
  let row = db.getByUser('u1')!;
  assert.equal(row.whitelisted_at, '2026-11-06T00:00:00.000Z');
  assert.equal(row.tx_hash, 'HASH');
  assert.equal(db.removable('2026-11-05T00:00:00.000Z').length, 0);
  assert.equal(db.removable('2026-11-07T00:00:00.000Z').length, 1);
  db.markRemoved([row.id], 'RM');
  row = db.getByUser('u1')!;
  assert.equal(row.status, 'removed');
  assert.ok(row.removed_at);
  assert.equal(db.removable().length, 0);
});

test('a removed player can request again, with whose addresses worked out afresh', () => {
  const db = openDb(':memory:');
  const claim = db.claim('u1', OWNER, OPERATOR, null, 10);
  assert.ok(claim.ok);
  db.setAdded(claim.row.id, true, false);
  db.markWhitelisted([claim.row.id], 'HASH');
  db.markRemoved([claim.row.id], 'RM');
  const again = db.claim('u1', OWNER, OPERATOR, null, 10);
  assert.ok(again.ok);
  assert.equal(again.row.status, 'pending');
  assert.equal(again.row.owner_added, null);
  assert.equal(again.row.operator_added, null);
});

// a stand-in for Yominet: a whitelist, and a send that adds to it
const fakeChain = (
  whitelist: Set<string>,
  opts: { failSend?: boolean; failConfirm?: boolean } = {}
) => {
  let reads = 0;
  const sent: string[][] = [];
  const chain = {
    addMsgs: (_auth: string, addresses: string[]) => addresses,
    onWhitelist: async (addresses: string[]) => {
      reads++;
      if (opts.failConfirm && reads === 2) throw new Error('rest timeout');
      return new Set(addresses.filter((a) => whitelist.has(a)));
    },
    send: async (addresses: string[]) => {
      if (opts.failSend) throw new Error('out of gas');
      sent.push(addresses);
      addresses.forEach((a) => whitelist.add(a));
      return { txHash: 'TX', timestamp: '2026-11-06T00:00:00Z', height: 1 };
    },
  };
  return { chain: chain as unknown as Chain, sent };
};

test('a grant whose confirmation fails stays pending and is picked up next round', async () => {
  const db = openDb(':memory:');
  const claim = db.claim('u1', OWNER, OPERATOR, null, 10);
  assert.ok(claim.ok);
  const whitelist = new Set<string>();
  const first = fakeChain(whitelist, { failConfirm: true });
  await processBatch(db, first.chain, 'auth');
  assert.equal(db.getByUser('u1')!.status, 'pending');

  await processBatch(db, fakeChain(whitelist).chain, 'auth');
  const row = db.getByUser('u1')!;
  assert.equal(row.status, 'whitelisted');
  // the earlier send added both, and that survives the recovery path
  assert.deepEqual(addedAddresses(row), [OWNER, OPERATOR]);
});

test('an address already on the whitelist is not ours to remove', async () => {
  const db = openDb(':memory:');
  assert.ok(db.claim('u1', OWNER, OPERATOR, null, 10).ok);
  const whitelist = new Set([toBech32(OWNER)]);
  const { chain, sent } = fakeChain(whitelist);
  await processBatch(db, chain, 'auth');
  const row = db.getByUser('u1')!;
  assert.equal(row.status, 'whitelisted');
  assert.deepEqual(sent, [[toBech32(OPERATOR)]]); // only the missing one was granted
  assert.deepEqual(addedAddresses(row), [OPERATOR]);
});

test('a failed send is still checked at cleanup', async () => {
  const db = openDb(':memory:');
  assert.ok(db.claim('u1', OWNER, OPERATOR, null, 10).ok);
  await processBatch(db, fakeChain(new Set(), { failSend: true }).chain, 'auth');
  assert.equal(db.getByUser('u1')!.status, 'failed');
  assert.equal(db.removable().length, 1);
});

test('wallets must be linked, in the right roles', () => {
  assert.ok(walletsMatch(linked, OWNER, OPERATOR));
  assert.ok(!walletsMatch(linked, OPERATOR, OWNER));
  assert.ok(!walletsMatch(linked, OWNER, '0x' + 'c'.repeat(40)));
});

test('newer embedded wallets count as the operator, not the owner', () => {
  const v2 = [
    { type: 'wallet', chainType: 'ethereum', address: OWNER, walletClientType: 'metamask' },
    { type: 'wallet', chainType: 'ethereum', address: OPERATOR, walletClientType: 'privy-v2' },
  ];
  assert.ok(walletsMatch(v2, OWNER, OPERATOR));
  assert.ok(!walletsMatch(v2, OPERATOR, OWNER));
});

test('address validation and rate limiter', () => {
  assert.ok(isEvmAddress(OWNER));
  assert.ok(!isEvmAddress('0x123'));
  const allowed = createRateLimiter(2, 1000);
  assert.ok(allowed('a', 0));
  assert.ok(allowed('a', 1));
  assert.ok(!allowed('a', 2));
  // blocked calls aren't recorded, so the window still opens on time
  for (let t = 3; t < 900; t++) assert.ok(!allowed('a', t));
  assert.ok(allowed('a', 1001));
  // quiet callers are forgotten
  allowed('b', 1002);
  allowed('c', 5000);
  assert.equal(allowed.size(), 1);
});

test('client IP comes from the tunnel header, never the caller-set first hop', () => {
  const req = (headers: Record<string, string>) =>
    ({ headers, socket: { remoteAddress: '127.0.0.1' } }) as unknown as IncomingMessage;
  assert.equal(
    clientIp(req({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' }), true),
    '1.1.1.1'
  );
  assert.equal(clientIp(req({ 'x-forwarded-for': '9.9.9.9, 2.2.2.2' }), true), '2.2.2.2');
  assert.equal(clientIp(req({ 'cf-connecting-ip': '1.1.1.1' }), false), '127.0.0.1');
  assert.equal(clientIp(req({}), true), '127.0.0.1');
});

let base = '';
let server: ReturnType<typeof createApi>;
before(async () => {
  server = createApi({
    db: openDb(':memory:'),
    auth: {
      verify: async (t) => {
        if (t !== 'good') throw new Error('bad token');
        return 'u1';
      },
      linkedAccounts: async () => linked,
    },
    origins: ['https://demo.kamigotchi.io'],
    cap: 10,
    trustProxy: false,
  });
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(() => server.close());

const post = (token: string | null, body: object) =>
  fetch(`${base}/sponsor`, {
    method: 'POST',
    headers: { origin: ORIGIN, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

test('API flow: auth, linked wallets, status', async () => {
  assert.equal((await post(null, { owner: OWNER, operator: OPERATOR })).status, 401);
  assert.equal((await post('bad', { owner: OWNER, operator: OPERATOR })).status, 401);
  const stranger = '0x' + 'c'.repeat(40);
  assert.equal((await post('good', { owner: stranger, operator: OPERATOR })).status, 403);
  const ok = await post('good', {
    owner: OWNER.toUpperCase().replace('0X', '0x'),
    operator: OPERATOR,
  });
  assert.equal(ok.status, 202);
  assert.equal(((await ok.json()) as any).status, 'pending');

  const res = await fetch(`${base}/sponsor?owner=${OWNER}&operator=${OPERATOR}`, {
    headers: { origin: ORIGIN },
  });
  assert.equal(((await res.json()) as any).status, 'pending');
  const none = await fetch(`${base}/sponsor?owner=${OPERATOR}&operator=${OWNER}`, {
    headers: { origin: ORIGIN },
  });
  assert.equal(((await none.json()) as any).status, 'none');
});

test('other origins and no origin are refused', async () => {
  const url = `${base}/sponsor?owner=${OWNER}&operator=${OPERATOR}`;
  const evil = await fetch(url, { headers: { origin: 'https://evil.example' } });
  assert.equal(evil.status, 403);
  assert.equal((await fetch(url)).status, 403);
  const posted = await fetch(`${base}/sponsor`, {
    method: 'POST',
    headers: { origin: 'https://evil.example', authorization: 'Bearer good' },
    body: JSON.stringify({ owner: OWNER, operator: OPERATOR }),
  });
  assert.equal(posted.status, 403);
});

test('CORS only echoes allowed origins', async () => {
  const good = await fetch(`${base}/health`, { headers: { origin: 'https://demo.kamigotchi.io' } });
  assert.equal(good.headers.get('access-control-allow-origin'), 'https://demo.kamigotchi.io');
  const bad = await fetch(`${base}/health`, { headers: { origin: 'https://evil.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});

test('a grant requested again after removal starts fresh, so an old cleanup cutoff skips it', () => {
  const db = openDb(':memory:');
  const claim = db.claim('u1', OWNER, OPERATOR, null, 10);
  assert.ok(claim.ok);
  db.setAdded(claim.row.id, true, true);
  db.markWhitelisted([claim.row.id], 'OLD', '2026-11-01T00:00:00.000Z');
  db.markRemoved([claim.row.id], 'RM');

  const again = db.claim('u1', OWNER, OPERATOR, null, 10);
  assert.ok(again.ok);
  assert.equal(again.row.whitelisted_at, null);
  assert.equal(again.row.tx_hash, null);
  assert.equal(again.row.removed_at, null);
  assert.ok(again.row.requested_at > '2026-11-02');

  // the new send lands but reports an error: an earlier event's cutoff must not revoke it
  db.setAdded(again.row.id, true, true);
  db.markFailed([again.row.id], 'boom');
  assert.equal(db.removable('2026-11-02T00:00:00.000Z').length, 0);
  assert.equal(db.removable().length, 1);

  // the report keeps the earlier grant, with its wallets, ahead of the new one
  const report = db.reportRows();
  assert.equal(report.length, 2);
  assert.equal(report[0].tx_hash, 'OLD');
  assert.equal(report[0].status, 'removed');
  assert.equal(report[0].owner_address, OWNER);
  assert.equal(report[1].status, 'failed');
});
