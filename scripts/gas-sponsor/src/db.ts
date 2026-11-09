import { DatabaseSync } from 'node:sqlite';

export type Status = 'pending' | 'whitelisted' | 'failed' | 'removed';

export interface Sponsorship {
  id: number;
  privy_user_id: string;
  owner_address: string;
  operator_address: string;
  status: Status;
  request_ip: string | null;
  requested_at: string;
  whitelisted_at: string | null;
  tx_hash: string | null;
  error: string | null;
  removed_at: string | null;
  removal_tx_hash: string | null;
  // whether this service put the address on the whitelist (1), or found it already there (0).
  // null: not known yet, or a row from before this was tracked (treated as added)
  owner_added: number | null;
  operator_added: number | null;
}

export type ClaimResult =
  | { ok: true; row: Sponsorship }
  | { ok: false; reason: 'wallet_taken' | 'cap_reached' };

/** The EVM addresses on this row that this service put on the whitelist. */
export const addedAddresses = (row: Sponsorship) => [
  ...(row.owner_added !== 0 ? [row.owner_address] : []),
  ...(row.operator_added !== 0 ? [row.operator_address] : []),
];

/** Every whitelist grant is recorded here, including when it happened and in which tx. */
export const openDb = (path: string) => {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS sponsorships (
      id INTEGER PRIMARY KEY,
      privy_user_id TEXT NOT NULL UNIQUE,
      owner_address TEXT NOT NULL UNIQUE,
      operator_address TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      request_ip TEXT,
      requested_at TEXT NOT NULL,
      whitelisted_at TEXT,
      tx_hash TEXT,
      error TEXT,
      removed_at TEXT,
      removal_tx_hash TEXT
    );
  `);
  // earlier grants of a row that was removed and then requested again, kept for the report
  db.exec(`
    CREATE TABLE IF NOT EXISTS past_grants (
      sponsorship_id INTEGER NOT NULL,
      requested_at TEXT NOT NULL,
      whitelisted_at TEXT,
      tx_hash TEXT,
      removed_at TEXT,
      removal_tx_hash TEXT
    );
  `);
  // columns added after the first release: add them to existing databases
  for (const column of ['owner_added', 'operator_added']) {
    try {
      db.exec(`ALTER TABLE sponsorships ADD COLUMN ${column} INTEGER`);
    } catch {
      // already there
    }
  }

  const now = () => new Date().toISOString();
  const all = (sql: string, ...args: any[]) =>
    db.prepare(sql).all(...args) as unknown as Sponsorship[];
  const one = (sql: string, ...args: any[]) =>
    db.prepare(sql).get(...args) as unknown as Sponsorship | undefined;

  const getByUser = (userId: string) =>
    one('SELECT * FROM sponsorships WHERE privy_user_id = ?', userId);

  const getByWallets = (owner: string, operator: string) =>
    one(
      'SELECT * FROM sponsorships WHERE owner_address = ? AND operator_address = ?',
      owner,
      operator
    );

  const activeCount = () =>
    (
      db.prepare(`SELECT COUNT(*) AS n FROM sponsorships WHERE status != 'removed'`).get() as {
        n: number;
      }
    ).n;

  /** One grant per Privy user and per wallet. A failed or removed grant can be requested again. */
  const claim = (
    userId: string,
    owner: string,
    operator: string,
    ip: string | null,
    cap: number
  ): ClaimResult => {
    const mine = getByUser(userId);
    if (mine) {
      if (mine.owner_address !== owner || mine.operator_address !== operator) {
        return { ok: false, reason: 'wallet_taken' };
      }
      if (mine.status === 'failed') {
        // a retry is a new attempt: date it now, so cleanup cutoffs judge it by this request
        db.prepare(
          `UPDATE sponsorships SET status = 'pending', error = NULL, requested_at = ? WHERE id = ?`
        ).run(now(), mine.id);
        return { ok: true, row: getByUser(userId)! };
      }
      if (mine.status === 'removed') {
        if (activeCount() >= cap) return { ok: false, reason: 'cap_reached' };
        // a fresh grant: archive the old one, then start from new dates and empty tx fields, so a
        // cleanup cutoff for an earlier event can't revoke it. whether we add each address gets
        // worked out again
        db.prepare(
          `INSERT INTO past_grants
             (sponsorship_id, requested_at, whitelisted_at, tx_hash, removed_at, removal_tx_hash)
           SELECT id, requested_at, whitelisted_at, tx_hash, removed_at, removal_tx_hash
           FROM sponsorships WHERE id = ?`
        ).run(mine.id);
        db.prepare(
          `UPDATE sponsorships
           SET status = 'pending', error = NULL, owner_added = NULL, operator_added = NULL,
               requested_at = ?, whitelisted_at = NULL, tx_hash = NULL,
               removed_at = NULL, removal_tx_hash = NULL
           WHERE id = ?`
        ).run(now(), mine.id);
        return { ok: true, row: getByUser(userId)! };
      }
      return { ok: true, row: mine };
    }

    const taken = one(
      `SELECT * FROM sponsorships
       WHERE owner_address IN (?, ?) OR operator_address IN (?, ?)`,
      owner,
      operator,
      owner,
      operator
    );
    if (taken) return { ok: false, reason: 'wallet_taken' };

    if (activeCount() >= cap) return { ok: false, reason: 'cap_reached' };

    db.prepare(
      `INSERT INTO sponsorships
         (privy_user_id, owner_address, operator_address, status, request_ip, requested_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`
    ).run(userId, owner, operator, ip, now());
    return { ok: true, row: getByUser(userId)! };
  };

  const pending = (limit: number) =>
    all(`SELECT * FROM sponsorships WHERE status = 'pending' ORDER BY id LIMIT ?`, limit);

  const markWhitelisted = (ids: number[], txHash: string | null, at: string = now()) => {
    const stmt = db.prepare(
      `UPDATE sponsorships
       SET status = 'whitelisted', whitelisted_at = ?, tx_hash = ?, error = NULL
       WHERE id = ?`
    );
    for (const id of ids) stmt.run(at, txHash, id);
  };

  /** Records whether each address was ours to add. Set once: a retry keeps the first answer. */
  const setAdded = (id: number, ownerAdded: boolean, operatorAdded: boolean) => {
    db.prepare(
      `UPDATE sponsorships
       SET owner_added = COALESCE(owner_added, ?), operator_added = COALESCE(operator_added, ?)
       WHERE id = ?`
    ).run(ownerAdded ? 1 : 0, operatorAdded ? 1 : 0, id);
  };

  const markFailed = (ids: number[], error: string) => {
    const stmt = db.prepare(`UPDATE sponsorships SET status = 'failed', error = ? WHERE id = ?`);
    for (const id of ids) stmt.run(error.slice(0, 500), id);
  };

  const markRemoved = (ids: number[], txHash: string) => {
    const stmt = db.prepare(
      `UPDATE sponsorships SET status = 'removed', removed_at = ?, removal_tx_hash = ? WHERE id = ?`
    );
    for (const id of ids) stmt.run(now(), txHash, id);
  };

  /**
   * Rows that may still hold whitelist entries this service added. Failed rows are included:
   * a grant can land on-chain even when its confirmation errored.
   */
  const removable = (before?: string) => {
    const where = `status IN ('whitelisted', 'failed')
      AND (owner_added IS NOT 0 OR operator_added IS NOT 0)`;
    return before
      ? all(
          `SELECT * FROM sponsorships WHERE ${where}
           AND COALESCE(whitelisted_at, requested_at) < ? ORDER BY id`,
          before
        )
      : all(`SELECT * FROM sponsorships WHERE ${where} ORDER BY id`);
  };

  const everything = () => all('SELECT * FROM sponsorships ORDER BY id');

  /** Every grant for the report: current ones plus archived earlier grants, with their wallets. */
  const reportRows = () =>
    all(
      `SELECT owner_address, operator_address, status, requested_at, whitelisted_at, tx_hash,
              removed_at, removal_tx_hash, id AS sponsorship_id, 1 AS current
       FROM sponsorships
       UNION ALL
       SELECT s.owner_address, s.operator_address, 'removed', p.requested_at, p.whitelisted_at,
              p.tx_hash, p.removed_at, p.removal_tx_hash, p.sponsorship_id, 0
       FROM past_grants p JOIN sponsorships s ON s.id = p.sponsorship_id
       ORDER BY sponsorship_id, current, requested_at`
    );

  return {
    claim,
    close: () => db.close(),
    everything,
    reportRows,
    getByUser,
    getByWallets,
    markFailed,
    markRemoved,
    markWhitelisted,
    pending,
    removable,
    setAdded,
  };
};

export type Db = ReturnType<typeof openDb>;
