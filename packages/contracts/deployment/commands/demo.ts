const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
import { spawnSync } from 'child_process';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

// Puts a world into demo mode and takes it back out, in one command each.
//   --up --quests 20000-20018   record which quests are live, disable them, pause transfers and
//                               the portal, apply demo tuning and shop rates, enable the demo quests
//   --down                      undo all of it from the recorded snapshot
//   --dry-run                   print the plan and what's on chain, change nothing
// The snapshot is what --down restores from, so --up refuses to overwrite one that exists.
// Commit it: losing it means rebuilding the restore list by hand. Refuses production.
// --quests takes indices that are on chain already or have rows in quests/quests.csv; it creates
// the missing ones from the csv and refuses any it can't find. The demo's own quests (20000-20018)
// aren't on main: their data is on feat/demo-playtest (#2531), so bring that in for a fresh world.
const argv = yargs(hideBin(process.argv))
  .option('up', { type: 'boolean', default: false })
  .option('down', { type: 'boolean', default: false })
  .option('quests', { type: 'string', describe: 'demo quest indices, on chain or in quests.csv, e.g. 1,2,5 or 20000-20018' })
  .option('dry-run', { type: 'boolean', default: false })
  .parse();

const ENV = process.env.NODE_ENV ?? '';
const DATA = join(__dirname, '../world/data');
const SNAPSHOT = join(DATA, `demo/snapshot.${ENV}.json`);
const BATCH = 40; // quests per tx batch: stays under the 4.5M gas cap on whitelisted deployers
const DEMO_BATCH = 3; // new quests carry objectives and rewards, so they batch smaller

interface Snapshot {
  world: string;
  takenAt: string;
  liveQuests: number[];
  demoQuests: number[];
}

const parseIndices = (spec: string): number[] =>
  spec.split(',').flatMap((part) => {
    const [a, b] = part.split('-').map((n) => Number(n.trim()));
    if (!Number.isInteger(a) || (b !== undefined && !Number.isInteger(b)))
      throw new Error(`demo: bad quest index "${part}"`);
    return b === undefined ? [a] : Array.from({ length: b - a + 1 }, (_, i) => a + i);
  });

const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size)
  );

// quest registry state on chain, for every quest index the data knows about
const readQuests = async (indices: number[]) => {
  const provider = new ethers.JsonRpcProvider(process.env.RPC!);
  const reg = ['function getEntitiesWithValue(uint256) view returns (uint256[])'];
  const world = new ethers.Contract(
    process.env.WORLD!,
    ['function components() view returns (address)'],
    provider
  );
  const components = new ethers.Contract(await world.components(), reg, provider);
  const comp = async (id: string) => {
    const found = await components.getEntitiesWithValue(BigInt(ethers.id(id)));
    return new ethers.Contract(
      ethers.getAddress(ethers.toBeHex(found[found.length - 1], 20)),
      ['function has(uint256) view returns (bool)'],
      provider
    );
  };
  const quest = await comp('component.index.quest');
  const disabled = await comp('component.is.disabled');
  const live: number[] = [];
  const off: number[] = [];
  for (const index of indices) {
    const id = BigInt(
      ethers.solidityPackedKeccak256(['string', 'uint32'], ['registry.quest', index])
    );
    if (!(await quest.has(id))) continue;
    ((await disabled.has(id)) ? off : live).push(index);
  }
  return { live, off };
};

// one world-state call through forge. retries only when the node pruned the state a long
// simulation needed and nothing was sent yet
const step = (label: string, args: string[], gas?: number) => {
  console.log(`- ${label}`);
  if (argv['dry-run']) return;
  const forge = gas ? [`--forge=-g=${gas} --slow`] : [];
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = spawnSync('pnpm', ['world:state:script', ...args, ...forge], {
      env: process.env,
      encoding: 'utf8',
    });
    let log = `${res.stdout}${res.stderr}`;
    if (process.env.PRIV_KEY) log = log.split(process.env.PRIV_KEY).join('<redacted>');
    if (res.status === 0 && !/Transaction Failure|revert/i.test(log)) return;
    const pruned = /historical version not found/.test(log) && !/Sending transactions/.test(log);
    if (pruned && attempt < 4) continue;
    console.error(log.split('\n').slice(-25).join('\n'));
    throw new Error(
      `demo: "${label}" failed. Nothing after it ran; fix and rerun the same command.`
    );
  }
};

const transfers = (flag: '--pause' | '--resume') => {
  console.log(`- transfers ${flag}`);
  if (argv['dry-run']) return;
  const res = spawnSync('pnpm', ['ts-node', 'deployment/commands/demoTransfers.ts', flag], {
    env: process.env,
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    console.error(`${res.stdout}${res.stderr}`.split('\n').slice(-15).join('\n'));
    throw new Error(`demo: transfers ${flag} failed`);
  }
};

const questBatches = (action: string, indices: number[], size = BATCH) =>
  chunk(indices, size).forEach((batch, i, all) =>
    step(`${action} quests ${batch[0]}..${batch[batch.length - 1]} (${i + 1}/${all.length})`, [
      '-c',
      'quests',
      '--action',
      action,
      '--args',
      batch.join(','),
    ])
  );

const up = async () => {
  if (!argv.quests) throw new Error('demo: --up needs --quests, e.g. --quests 20000-20018');
  if (existsSync(SNAPSHOT))
    throw new Error(`demo: ${SNAPSHOT} exists, so a demo looks live. Run --down first.`);
  const demo = parseIndices(argv.quests);

  const csv = parse(readFileSync(join(DATA, 'quests/quests.csv'), 'utf8'), {
    columns: true,
    bom: true,
  }) as Record<string, string>[];
  const known = csv.map((r) => Number(r['Index'])).filter((i) => i && !demo.includes(i));
  const { live } = await readQuests(known);
  const demoState = await readQuests(demo);
  const toEnable = demoState.off;
  const toInit = demo.filter((i) => !demoState.off.includes(i) && !demoState.live.includes(i));
  // quests init silently skips indices the csv lacks, so a missing row would leave the demo short
  const missing = toInit.filter((i) => !csv.some((r) => Number(r['Index']) === i));
  if (missing.length)
    throw new Error(
      `demo: quests ${missing.join(',')} are neither on chain nor in quests/quests.csv`
    );
  console.log(
    `${live.length} regular quests live, demo quests: ${toEnable.length} to enable, ${toInit.length} to create`
  );

  const snapshot: Snapshot = {
    world: process.env.WORLD!,
    takenAt: new Date().toISOString(),
    liveQuests: live,
    demoQuests: demo,
  };
  if (!argv['dry-run']) {
    mkdirSync(dirname(SNAPSHOT), { recursive: true });
    writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 1) + '\n');
    console.log(`saved ${SNAPSHOT}: commit it`);
  }

  questBatches('disable', live);
  step('portal off', ['-c', 'portal', '--action', 'disable']);
  transfers('--pause');
  step('demo tuning', ['-c', 'configs', '--action', 'initDemo']);
  step('demo shop rates', ['-c', 'listings', '--action', 'setDemoRates'], 400);
  questBatches('enable', toEnable);
  chunk(toInit, DEMO_BATCH).forEach((batch) =>
    step(
      `create quests ${batch.join(',')}`,
      ['-c', 'quests', '--action', 'init', '--args', batch.join(',')],
      250
    )
  );
  console.log('demo is up');
};

const down = async () => {
  if (!existsSync(SNAPSHOT)) throw new Error(`demo: no ${SNAPSHOT}, nothing to restore from`);
  const snapshot: Snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  if (snapshot.world.toLowerCase() !== process.env.WORLD!.toLowerCase())
    throw new Error(`demo: snapshot is for ${snapshot.world}, not ${process.env.WORLD}`);

  // only quests on chain and in the wrong state: a partial --up may not have created every demo quest
  const regular = await readQuests(snapshot.liveQuests);
  const demoNow = await readQuests(snapshot.demoQuests);
  questBatches('enable', regular.off);
  questBatches('disable', demoNow.live);
  step('reset tuning', ['-c', 'configs', '--action', 'resetDemo']);
  step('restore shop rates', ['-c', 'listings', '--action', 'restoreRates'], 400);
  step('portal on', ['-c', 'portal', '--action', 'enable']);
  transfers('--resume');

  const { live, off } = await readQuests(snapshot.liveQuests);
  const demoLive = (await readQuests(snapshot.demoQuests)).live;
  console.log(
    `check: ${live.length}/${snapshot.liveQuests.length} regular quests live, ${demoLive.length} demo quests live`
  );
  if (argv['dry-run']) return;
  if (off.length || demoLive.length) throw new Error('demo: rollback incomplete, see check above');
  const done = SNAPSHOT.replace(/\.json$/, `.restored-${Date.now()}.json`);
  renameSync(SNAPSHOT, done);
  console.log(`demo is down. Snapshot kept as ${done}`);
};

const run = async () => {
  if (ENV === 'production' || !ENV) throw new Error('demo: set NODE_ENV to testing or local');
  if (argv.up === argv.down) throw new Error('demo: pick --up or --down');
  if (argv['dry-run']) console.log('dry run: nothing will be sent');
  await (argv.up ? up() : down());
};

run().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
