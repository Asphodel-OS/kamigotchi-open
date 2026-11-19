import { readFileSync } from 'fs';

// Sends the transactions of a simulated `forge script` run to a local anvil node.
//
// forge's own broadcaster costs 0.2-0.5s per transaction (it journals the whole run
// after each one), which is 20-45 minutes for the ~5,000 transactions of a world
// deploy. Anvil mines them in seconds, so for local deploys we let forge simulate
// (no --broadcast) and replay the transaction list it writes.
//
// Local only: it sends unsigned transactions through anvil's impersonation.

type ScriptTx = {
  transaction: {
    from: string;
    to?: string;
    gas?: string;
    value?: string;
    input: string;
    nonce: string;
  };
};

// per request: anvil rejects bodies over 2MB, and contract creations are large
const MAX_TXS = 200;
const MAX_BYTES = 1_000_000;

const rpc = async (url: string, calls: { method: string; params: unknown[] }[]) => {
  const body = calls.map((c, id) => ({ jsonrpc: '2.0', id, ...c }));
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rpc http ${res.status}`);
  const out = (await res.json()) as { id: number; result?: any; error?: { message: string } }[];
  if (!Array.isArray(out))
    throw new Error(`rpc batch rejected: ${JSON.stringify(out).slice(0, 300)}`);
  out.sort((a, b) => a.id - b.id);
  return out;
};

export async function broadcastToAnvil(runFile: string, url: string) {
  if (process.env.NODE_ENV !== 'local') throw new Error('broadcastToAnvil is local only');
  const txs: ScriptTx[] = JSON.parse(readFileSync(runFile, 'utf8')).transactions;
  const started = Date.now();

  // one block for the whole batch keeps the chain short; the block gas limit is
  // the node's, so a batch that doesn't fit simply spills into the next block
  await rpc(url, [
    { method: 'anvil_autoImpersonateAccount', params: [true] },
    { method: 'evm_setAutomine', params: [false] },
  ]);

  try {
    for (let i = 0, n = 0; i < txs.length; i += n) {
      let bytes = 0;
      for (n = 0; i + n < txs.length && n < MAX_TXS; n++) {
        bytes += txs[i + n].transaction.input.length;
        if (n > 0 && bytes > MAX_BYTES) break;
      }
      const batch = txs.slice(i, i + n);
      const sent = await rpc(
        url,
        batch.map(({ transaction: t }) => ({
          method: 'eth_sendTransaction',
          params: [
            { from: t.from, to: t.to, gas: t.gas, value: t.value, data: t.input, nonce: t.nonce },
          ],
        }))
      );
      const failed = sent.findIndex((r) => r.error);
      if (failed >= 0) throw new Error(`tx ${i + failed} rejected: ${sent[failed].error!.message}`);

      // mine until the batch's last transaction has a receipt
      const hashes = sent.map((r) => r.result as string);
      for (let tries = 0; ; tries++) {
        await rpc(url, [{ method: 'evm_mine', params: [] }]);
        const [last] = await rpc(url, [
          { method: 'eth_getTransactionReceipt', params: [hashes[hashes.length - 1]] },
        ]);
        if (last.result) break;
        if (tries > 50) throw new Error(`tx ${i + batch.length - 1} was never mined`);
      }

      const receipts = await rpc(
        url,
        hashes.map((h) => ({ method: 'eth_getTransactionReceipt', params: [h] }))
      );
      const reverted = receipts.findIndex((r) => r.result?.status !== '0x1');
      if (reverted >= 0) throw new Error(`tx ${i + reverted} reverted (${hashes[reverted]})`);
    }
  } finally {
    await rpc(url, [
      { method: 'evm_setAutomine', params: [true] },
      { method: 'anvil_autoImpersonateAccount', params: [false] },
    ]);
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`** Sent ${txs.length} transactions to anvil in ${secs}s **`);
}

// ts-node deployment/scripts/localBroadcast.ts <run file> [rpc url]
if (require.main === module) {
  const [runFile, url = 'http://127.0.0.1:8545'] = process.argv.slice(2);
  broadcastToAnvil(runFile, url).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
