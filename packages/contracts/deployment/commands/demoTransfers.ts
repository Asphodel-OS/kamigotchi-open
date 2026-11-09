const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
import dotenv from 'dotenv';
import { ethers } from 'ethers';
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

// Temporarily blocks player transfers on the test world during a demo, without changing any contract.
// Each system loses write access to one component it always writes, so its calls revert.
// Read-only by default. --pause revokes, --resume restores. Refuses production.
const argv = yargs(hideBin(process.argv))
  .option('pause', { type: 'boolean', default: false })
  .option('resume', { type: 'boolean', default: false })
  .parse();

const VALUE = 'component.value';
const OWNS_KAMI = 'component.id.kami.owns';
const TARGETS: [string, string][] = [
  ['system.item.transfer', VALUE],
  ['system.trade.create', VALUE],
  ['system.trade.execute', VALUE],
  ['system.trade.complete', VALUE],
  ['system.kami.send', OWNS_KAMI],
  ['system.kami721.stake', OWNS_KAMI],
  ['system.kami721.unstake', OWNS_KAMI],
];

const run = async () => {
  const env = process.env.NODE_ENV;
  if (env !== 'testing' && env !== 'local')
    throw new Error('demoTransfers: test or local world only');
  if (argv.pause && argv.resume) throw new Error('demoTransfers: pick --pause or --resume');

  const provider = new ethers.JsonRpcProvider(process.env.RPC!);
  const signer =
    argv.pause || argv.resume ? new ethers.Wallet(process.env.PRIV_KEY!, provider) : provider;
  const world = new ethers.Contract(
    process.env.WORLD!,
    ['function systems() view returns (address)', 'function components() view returns (address)'],
    provider
  );
  const registry = async (addr: string) =>
    new ethers.Contract(
      addr,
      ['function getEntitiesWithValue(uint256) view returns (uint256[])'],
      provider
    );
  const systems = await registry(await world.systems());
  const components = await registry(await world.components());

  const lookup = async (reg: ethers.Contract, id: string): Promise<string> => {
    const entities = await reg.getEntitiesWithValue(BigInt(ethers.id(id)));
    if (entities.length !== 1)
      throw new Error(`demoTransfers: ${id} has ${entities.length} addresses`);
    return ethers.getAddress(ethers.toBeHex(entities[0], 20));
  };

  for (const [systemID, componentID] of TARGETS) {
    const system = await lookup(systems, systemID);
    const component = new ethers.Contract(
      await lookup(components, componentID),
      [
        'function writeAccess(address) view returns (bool)',
        'function authorizeWriter(address)',
        'function unauthorizeWriter(address)',
      ],
      signer
    );
    const canWrite: boolean = await component.writeAccess(system);
    if (argv.pause && canWrite) await (await component.unauthorizeWriter(system)).wait();
    if (argv.resume && !canWrite) await (await component.authorizeWriter(system)).wait();
    const now: boolean = await component.writeAccess(system);
    console.log(`${systemID}: ${now ? 'open' : 'PAUSED'}`);
  }

  // the Kami marketplace has its own switch; re-enabled by --resume
  if (argv.pause || argv.resume) {
    const market = new ethers.Contract(
      await lookup(systems, 'system.kamimarket.registry'),
      ['function setEnabled(bool)'],
      signer
    );
    await (await market.setEnabled(argv.resume)).wait();
    console.log(`kami market: ${argv.resume ? 'open' : 'PAUSED'}`);
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
