// TODO: fix gas wei conversion
const txCostEst = 1 / 10e4;

export const GasConstants = {
  Max: 1500 * txCostEst,
  Full: 1000 * txCostEst,
  Half: 500 * txCostEst,
  Quarter: 250 * txCostEst,
  Low: 100 * txCostEst,
  Warning: 10 * txCostEst,
  Empty: 1 * txCostEst,
};

export const GasExponent = 18;

// when set, gas is sponsored: players are added to Yominet's fee whitelist and send at price 0
export const GasSponsorURL: string | undefined = import.meta.env.VITE_GAS_SPONSOR_URL;
export const isGasSponsored = !!GasSponsorURL;

// the chain rejects any tx from a whitelisted wallet whose gas limit is above this
export const FreeLaneGasLimit = 4_500_000n;
