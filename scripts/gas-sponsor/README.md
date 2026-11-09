# Gas sponsor

One-click free gas for the public demo. A player clicks a button, and their owner and operator wallets get 1 wei of dust and are added to Yominet's `fee_whitelist` in a single transaction. Every grant is recorded with when it happened.

## Event-only

This is a short, supervised event tool, never a standing feature. The fee whitelist is a chain parameter, so a grant gives free gas on every contract on Yominet, not just the event world, and the signer keeps the chain admin key online.

- **Run the signer only for the event window**, with a low `MAX_SPONSORED_PLAYERS`.
- **Run removal when the event ends** (`npm run remove -- --all --confirm`). Grants never expire on their own.
- **Never set `VITE_GAS_SPONSOR_URL` on a main-world build.** The client build refuses to start if it is set with the main world's address.
- **Unset `VITE_GAS_SPONSOR_URL` and rebuild once the event ends.** A sponsored build has no fallback: if the API is unreachable, signup stalls on "could not reach the gas server".
- The API accepts any login of the client's Privy app, which is shared with the main-world client, so `MAX_SPONSORED_PLAYERS` is the only bound on who gets in.

Before any longer-lived free-play mode, this needs automatic expiry in the signer, a kill switch, a dedicated Privy app for sponsored builds, and a design that doesn't keep the admin key online.

## Processes

| Process | Holds | Exposed |
|---|---|---|
| `npm run api` | Privy secret | Public, behind HTTPS |
| `npm run signer` | Yominet opchild admin key | Nothing: it only reads the database |

They share the SQLite file at `DB_PATH`. Settings live in `.env.api` and `.env.signer`, and the API refuses to start if `SIGNER_PRIVATE_KEY` is in its environment. The signer refuses to start unless its key is the chain's current admin.

**The admin key controls all of Yominet, not just this demo.** Never expose the signer or log its environment.

## Run

```sh
npm install
cp .env.api.example .env.api         # fill in the Privy settings
cp .env.signer.example .env.signer   # fill in the admin key
npm run dry-run        # simulates a grant with the real key, sends nothing
npm run signer
npm run api
```

Point a tunnel or proxy at the API port, then set `VITE_GAS_SPONSOR_URL` on the client build. Leaving it unset turns sponsorship off.

## Records and cleanup

```sh
npm run report                                      # CSV of every player and timestamp
npm run remove -- --before 2026-11-10T00:00:00Z     # preview
npm run remove -- --all --confirm                   # remove everyone this server added
```

Removal only touches addresses in this database, never the chain's other whitelist entries.

## Limits

- Only `ALLOWED_ORIGINS` can call `/sponsor`. This stops other websites, not scripts faking the header; the Privy login check covers those.

- Whitelisted wallets can't send a transaction with a gas limit above 4.5M, even if they pay. The client caps limits to match.
- Whitelisted wallets have free gas on all of Yominet until removed.
