// Public endpoint. Holds no chain key: it checks the player and queues the request.
import { PrivyClient } from '@privy-io/server-auth';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { openDb, type Db, type Sponsorship } from './db.ts';

const MAX_BODY_BYTES = 1_024;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 10;

export const isEvmAddress = (value: unknown): value is string =>
  typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);

// Privy reports embedded wallets as 'privy' or, on its newer wallets, 'privy-v2'
const isEmbedded = (wallet: any) =>
  wallet.connectorType === 'embedded' || String(wallet.walletClientType).startsWith('privy');

/** Pulls the player's wallets out of their Privy profile; the client can't vouch for them. */
export const walletsMatch = (linked: any[], owner: string, operator: string) => {
  const wallets = linked.filter((a) => a.type === 'wallet' && a.chainType === 'ethereum');
  const has = (address: string, embedded: boolean) =>
    wallets.some((w) => w.address?.toLowerCase() === address && isEmbedded(w) === embedded);
  return has(owner, false) && has(operator, true);
};

export const createRateLimiter = (max = RATE_MAX_REQUESTS, windowMs = RATE_WINDOW_MS) => {
  const hits = new Map<string, number[]>();
  let lastSweep = 0;
  const allowed = (key: string, at = Date.now()) => {
    // forget callers that have gone quiet, so memory doesn't grow with every address seen
    if (at - lastSweep > windowMs) {
      for (const [k, times] of hits) if (at - times[times.length - 1] >= windowMs) hits.delete(k);
      lastSweep = at;
    }
    const recent = (hits.get(key) ?? []).filter((t) => at - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent); // blocked: don't record more, so rejecting stays cheap
      return false;
    }
    recent.push(at);
    hits.set(key, recent);
    return true;
  };
  allowed.size = () => hits.size;
  return allowed;
};

/**
 * The caller's address. Behind cloudflared (TRUST_PROXY=1) that's CF-Connecting-IP, which the
 * tunnel sets itself; failing that, the last X-Forwarded-For hop, the one the proxy appended.
 * The leftmost hop is whatever the caller sent, so it's never used.
 */
export const clientIp = (req: IncomingMessage, trustProxy: boolean) => {
  if (trustProxy) {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.trim()) return cf.trim();
    const forwarded = req.headers['x-forwarded-for'];
    const hops = typeof forwarded === 'string' ? forwarded.split(',') : [];
    const last = hops[hops.length - 1]?.trim();
    if (last) return last;
  }
  return req.socket.remoteAddress ?? 'unknown';
};

const statusBody = (row?: Sponsorship) => ({
  status: row?.status ?? 'none',
  whitelistedAt: row?.whitelisted_at ?? null,
});

export interface Auth {
  verify: (token: string) => Promise<string>;
  linkedAccounts: (userId: string) => Promise<any[]>;
}

interface Options {
  db: Db;
  auth: Auth;
  origins: string[];
  cap: number;
  trustProxy: boolean;
}

export const createApi = ({ db, auth, origins, cap, trustProxy }: Options) => {
  const allowed = createRateLimiter();

  const readJson = async (req: IncomingMessage) => {
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw new Error('body too large');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString());
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (code: number, body: object) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    const origin = req.headers.origin;
    if (origin && origins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'origin');
      res.setHeader('access-control-allow-headers', 'authorization, content-type');
      res.setHeader('access-control-allow-methods', 'GET, POST');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') return reply(200, { ok: true });

    // browsers can't fake this header, so other sites can't use the API. scripts can, which is
    // why grants also need a Privy login with linked wallets
    if (!origin || !origins.includes(origin)) return reply(403, { error: 'origin_not_allowed' });

    if (req.method === 'GET' && url.pathname === '/sponsor') {
      const owner = url.searchParams.get('owner');
      const operator = url.searchParams.get('operator');
      if (!isEvmAddress(owner) || !isEvmAddress(operator)) {
        return reply(400, { error: 'invalid_address' });
      }
      return reply(200, statusBody(db.getByWallets(owner.toLowerCase(), operator.toLowerCase())));
    }

    if (req.method === 'POST' && url.pathname === '/sponsor') {
      const ip = clientIp(req, trustProxy);
      if (!allowed(ip)) return reply(429, { error: 'rate_limited' });

      const token = req.headers.authorization?.replace(/^Bearer /, '');
      if (!token) return reply(401, { error: 'unauthorized' });
      let userId: string;
      try {
        userId = await auth.verify(token);
      } catch (e: any) {
        console.warn(`refused: token not verified (${e?.message ?? e})`);
        return reply(401, { error: 'unauthorized' });
      }

      let body: any;
      try {
        body = await readJson(req);
      } catch {
        return reply(400, { error: 'invalid_body' });
      }
      if (!isEvmAddress(body?.owner) || !isEvmAddress(body?.operator)) {
        return reply(400, { error: 'invalid_address' });
      }
      const owner = body.owner.toLowerCase();
      const operator = body.operator.toLowerCase();

      const existing = db.getByUser(userId);
      if (existing?.status !== 'whitelisted') {
        const linked = await auth.linkedAccounts(userId);
        if (!walletsMatch(linked, owner, operator)) {
          const types = linked.filter((a) => a.type === 'wallet').map((a) => a.walletClientType);
          console.warn(`refused: wallets not linked for ${userId}, linked types: ${types}`);
          return reply(403, { error: 'wallets_not_linked' });
        }
      }

      const claim = db.claim(userId, owner, operator, ip, cap);
      if (!claim.ok) return reply(409, { error: claim.reason });
      return reply(202, statusBody(claim.row));
    }

    reply(404, { error: 'not_found' });
  };

  return createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error(`request failed: ${e?.message ?? e}`);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal' }));
    });
  });
};

const main = () => {
  if (process.env.SIGNER_PRIVATE_KEY) {
    throw new Error('the API must not run with SIGNER_PRIVATE_KEY in its environment');
  }
  const privy = new PrivyClient(process.env.PRIVY_APP_ID!, process.env.PRIVY_APP_SECRET!);
  const port = Number(process.env.PORT ?? 8787);
  // localhost by default: the tunnel connects locally, and nothing can reach the API around it
  // to fake the headers TRUST_PROXY relies on
  const host = process.env.HOST ?? '127.0.0.1';
  createApi({
    db: openDb(process.env.DB_PATH ?? './sponsor.db'),
    auth: {
      verify: async (token) => (await privy.verifyAuthToken(token)).userId,
      linkedAccounts: async (userId) => (await privy.getUserById(userId)).linkedAccounts,
    },
    origins: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
    cap: Number(process.env.MAX_SPONSORED_PLAYERS ?? 500),
    trustProxy: process.env.TRUST_PROXY === '1',
  }).listen(port, host, () => console.log(`gas sponsor API on ${host}:${port}`));
};

if (import.meta.url === `file://${process.argv[1]}`) main();
