# `gas/` — gas analysis

Where the gas goes inside a system call. Runs Foundry tests locally; nothing here
touches a network or uses keys.

## `breakdown`

```bash
cd packages/contracts
pnpm gas:breakdown                       # the five heaviest systems, solc
pnpm gas:breakdown --solar               # same, compiled with Solar
pnpm gas:breakdown --detail              # plus top components and library calls
pnpm gas:breakdown HarvestStopSystem     # one system
pnpm gas:breakdown --match testBuyChargesPausedPrice AuctionBuySystem   # another test and system
```

[`measure/breakdown.sh`](measure/breakdown.sh) runs the matching tests with `-vvvv`
under the **default** profile (optimizer on, the profile deploys use; `pnpm test`
uses the unoptimized `build` profile, so its gas numbers are not the deployed ones).
[`measure/breakdown.cjs`](measure/breakdown.cjs) then takes the last
`<System>::execute*` call in the trace and charges each call in its tree its self
gas (its total minus its children's), bucketed by the kind of call:

| Bucket | What lands in it |
| --- | --- |
| component writes | non-static calls to a component (`set`, `remove`, …) |
| component reads | static calls to a component |
| registry address lookups | `getEntitiesWithValue` on the registry, made before each component access to resolve its address |
| system + library logic | the system's own frame and its libraries, including the overhead of making each external call |
| world events / registration | calls to the World and the emitter |

Defaults: tests `testTrackHarvestTime|testMurderBasic`, systems `HarvestStart`,
`HarvestCollect`, `HarvestStop`, `HarvestLiquidate`, `KamiUseItem`.

Each run writes one JSON per system to `measure/reports/breakdown/`. Build output
goes to `measure/cache/<compiler>/` so it doesn't evict the `build`-profile
artifacts in `packages/contracts/out`. Both directories are gitignored. The first
solc run compiles everything with the optimizer on and takes several minutes;
later runs reuse the cache.

## Limits

- **Call level, not opcode level.** It can't split SSTORE from SLOAD inside a
  component, or separate a system's computation from its call overhead. That needs
  a `debug_traceTransaction` opcode trace against a node (anvil with
  `--steps-tracing`), which isn't built here.
- **Test-world state.** Gas depends on cold and warm slots and on how much state a
  kami and account carry. Compare against live transactions before relying on a
  total.
- **One sample.** It reads the last matching call of a single test run.
