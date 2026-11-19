#!/usr/bin/env node
// Buckets the gas of one system call from a `forge test -vvvv` call trace.
//
//   node breakdown.cjs <trace.txt> <SystemName> [--detail] [--json <file>]
//
// Takes the last `<SystemName>::execute*` call in the trace and splits its gas by
// the kind of call that spent it. Each call is charged its SELF gas: its own total
// minus its children's.
const fs = require('fs');

const CALL = /^((?:│   |    )*)[├└]─ \[(\d+)\] ([^\s:(]+)::([^\s(]+)\((.*)$/;

const LOGIC = 'system + library logic';
const REGISTRY = 'registry address lookups';
const WORLD = 'world events / registration';
const READS = 'component reads';
const WRITES = 'component writes';

function parse(path) {
  const roots = [];
  const stack = [];
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    const m = CALL.exec(line);
    if (!m) continue;
    const rest = m[5];
    const kind = rest.endsWith('[staticcall]')
      ? 'staticcall'
      : rest.endsWith('[delegatecall]')
        ? 'delegatecall'
        : 'call';
    const node = {
      depth: m[1].length / 4,
      gas: Number(m[2]),
      contract: m[3],
      fn: m[4],
      kind,
      children: [],
    };
    while (stack.length && stack[stack.length - 1].depth >= node.depth) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}

function find(roots, name) {
  const out = [];
  const walk = (n) => {
    if (n.contract === name && n.fn.startsWith('execute')) return void out.push(n);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

const isLib = (n) => n.kind === 'delegatecall' || n.contract.startsWith('Lib');

function classify(n, top) {
  const c = n.contract;
  if (top || isLib(n)) return LOGIC;
  // every component access first resolves the component's address in the registry
  if (c === 'Uint256Component' && n.fn === 'getEntitiesWithValue') return REGISTRY;
  if (c === 'World' || c.endsWith('Emitter')) return WORLD;
  if (c.includes('Component')) return n.kind === 'staticcall' ? READS : WRITES;
  if (c.endsWith('System')) return LOGIC;
  return `other external (${c})`;
}

function bucket(root) {
  const buckets = {};
  const counts = {};
  const components = {};
  const add = (obj, key, v) => (obj[key] = (obj[key] || 0) + v);
  const walk = (n, top) => {
    const self = n.gas - n.children.reduce((s, c) => s + c.gas, 0);
    const key = classify(n, top);
    add(buckets, key, self);
    add(counts, key, 1);
    if (key === READS || key === WRITES) add(components, `${key === READS ? 'R' : 'W'} ${n.contract}`, self);
    n.children.forEach((c) => walk(c, false));
  };
  walk(root, true);
  // inclusive gas of the library calls made directly by the system
  const libs = {};
  for (const c of root.children) if (isLib(c)) add(libs, `${c.contract}::${c.fn}`, c.gas);
  return { total: root.gas, buckets, counts, components, libs };
}

const desc = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
const num = (v) => v.toLocaleString('en-US');
const pct = (v, total) => `${((v / total) * 100).toFixed(1)}%`.padStart(6);

function main() {
  const args = process.argv.slice(2);
  const detail = args.includes('--detail');
  const jsonAt = args.indexOf('--json');
  const jsonPath = jsonAt >= 0 ? args[jsonAt + 1] : undefined;
  const [path, name] = args.filter(
    (a, i) => !a.startsWith('--') && (jsonAt < 0 || i !== jsonAt + 1)
  );
  if (!path || !name) {
    console.error('usage: breakdown.cjs <trace.txt> <SystemName> [--detail] [--json <file>]');
    process.exit(2);
  }

  const hits = find(parse(path), name);
  if (!hits.length) {
    console.error(`no ${name}::execute* call in ${path}`);
    process.exit(1);
  }
  const r = bucket(hits[hits.length - 1]);

  console.log(`${name}  total ${num(r.total)}  (calls in trace: ${hits.length}, showing the last)`);
  for (const [k, v] of desc(r.buckets)) {
    console.log(`  ${num(v).padStart(10)} ${pct(v, r.total)}  x${String(r.counts[k]).padEnd(4)} ${k}`);
  }
  if (detail) {
    console.log('  top components (self gas):');
    for (const [k, v] of desc(r.components).slice(0, 10)) console.log(`    ${num(v).padStart(9)} ${k}`);
    console.log('  library calls made by the system (inclusive):');
    for (const [k, v] of desc(r.libs).slice(0, 10)) {
      console.log(`    ${num(v).padStart(9)} ${pct(v, r.total)} ${k}`);
    }
  }
  if (jsonPath) {
    const out = { name, total: r.total, buckets: r.buckets, counts: r.counts, libs: r.libs };
    fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2) + '\n');
  }
}

main();
