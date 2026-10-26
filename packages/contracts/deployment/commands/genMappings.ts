import {
  genClientSystemData,
  genContractSystemData,
  generateComponentSchemas,
  pruneFactoryExports,
} from '../scripts/codegen';

const run = async () => {
  genClientSystemData();
  genContractSystemData();
  generateComponentSchemas();
  pruneFactoryExports();
};

run();
