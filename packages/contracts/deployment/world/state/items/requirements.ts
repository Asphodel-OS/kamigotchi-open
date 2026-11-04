import { AdminAPI } from '../../api';
import { getSheet, parseToInitCon } from '../utils';

export const Requirements = new Map<string, any>();

// retrieve the singleton Map of all Requirements
// if it hasn't been instantiated, populate it with the item requirements sheet
export const getRequirementsMap = async () => {
  if (Requirements.size > 0) return Requirements;

  const csv = await getSheet('items', 'requirements');
  for (let i = 0; i < csv.length; i++) {
    const row = csv[i];
    const key = row['Name'];
    if (!Requirements.has(key)) Requirements.set(key, row);
  }
  return Requirements;
};

// find and add all the requirements of a item
export const addRequirements = async (api: AdminAPI, itemRow: any) => {
  const index = Number(itemRow['Index']);

  const map = await getRequirementsMap();
  const keys = String(itemRow['Requirements'] ?? '').split(',').map((k: string) => k.trim());
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!key) continue;

    const req = map.get(key);
    if (!req) throw new Error(`Could not find Requirement ${key} for item ${index}`);
    await addRequirement(api, index, req);
  }
};

// add a single requirement to an item
export async function addRequirement(api: AdminAPI, itemIndex: number, entry: any) {
  const type = entry['Type'];
  const index = Number(entry['Index'] ?? 0);
  const value = Number(entry['Value'] ?? 0);
  const preposition = entry['Preposition'];
  const cond = parseToInitCon(preposition, type, index, value);

  console.log(`  Adding Requirement (${type}) (${cond.logicType}) (${index}) (${value})`);
  await api.registry.item.add.requirement(
    itemIndex,
    'USE',
    cond.type,
    cond.logicType,
    cond.index,
    cond.value,
    ''
  );
}
