import { readFile, writeFile } from 'fs/promises';
import { clientDir } from '../../utils/paths';

// build:abi:types deletes typechain's factories, so drop their re-exports from the index
export async function pruneFactoryExports() {
  const indexPath = clientDir + 'types/ethers-contracts/index.ts';
  const index = await readFile(indexPath, 'utf8');
  const lines = index.split('\n').filter((line) => !line.includes('from "./factories'));
  await writeFile(indexPath, lines.join('\n'));
}
