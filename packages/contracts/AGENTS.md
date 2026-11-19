# Contracts: building and testing on a machine with 8 GB or less

This applies only when the machine has 8 GB of memory or less, for example a factory agent session (2 CPUs, 8 GB, no swap). On a machine with more memory, use the normal scripts in `package.json` and ignore this file.

## The problem

`pnpm test` and `forge test --contracts test` compile every test file, even when you ask for one test. Each test contract embeds the deploy of every system, so compiling them all needs about 7.4 GB. On an 8 GB machine that runs out of memory, and in an agent session the whole session is killed with no error message.

## What to run instead

Run these in order, from `packages/contracts`:

```bash
FOUNDRY_PROFILE=build forge build --skip test
pnpm build:codegen
FOUNDRY_PROFILE=build forge test --gas-limit=10000000000000 --match-path test/systems/Experience.t.sol
```

1. `forge build --skip test` compiles the sources only. About 25 seconds and 1.2 GB.
2. `pnpm build:codegen` generates the deploy and test setup files. It reads the compiled output in `out/`, so it fails with "Cannot find module '../../../out/...'" if step 1 has not run.
3. `forge test --match-path <one test file>` compiles and runs that file only. About 30 seconds and 1.5 GB.

If your change alters what the client sees of a contract (a public function, an event, or a system or component added, removed or renamed), also run:

```bash
pnpm build:abi
```

It rewrites the committed files in `packages/client/abi` and `packages/client/types` from the output of step 1. About 10 seconds and under 1 GB. It needs `jq` on the machine. Commit the files it changes. When nothing the client sees has changed, it changes no files.

## Rules

- Never run `pnpm test`, `pnpm build`, or `forge test` without `--match-path`. `pnpm build:abi` by itself is fine.
- Never pass `--contracts test`. That flag is what makes Foundry compile every test file.
- Give `--match-path` one test file at a time. A pattern that matches many files brings the memory cost back.
- Run every test file that covers the code you changed. No CI job runs the contracts tests, so a test you do not run is not run by anything.
- To run more of the suite, run the files one after another, each with its own `--match-path`. Do not combine them into one command.
- Say in the pull request which test files you ran, and that the full suite was not run.

## What does not help

Measured on 2 CPUs and 8 GB with Foundry 1.5.1: `--threads 1`, sparse mode and dynamic test linking all still peak at about 7.4 GB when `--contracts test` is used. The default (optimised) profile peaks at 6.0 GB and takes four times as long.
