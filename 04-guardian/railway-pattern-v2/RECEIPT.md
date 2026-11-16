# RECEIPT — Railway Pattern v2, tested draft (2026-11-15)

**Tested draft — not a final build. Final builds gate on specialist agreement (AEGIS / Frontier / Guardian desk) and the podcast, per David's sequence (2026-11-15).**

Commission (David, 2026-11-15): take the Railway pattern from the old Guardian
code, update it as an idea, test it (the old code "was never truly tested"),
and file it into the new GitHub — `gamemastersentertainment/koda-kai-network`,
Guardian wing — as part of walking away from the old GitHub toward
better-tested solutions. Originals untouched throughout.

## What was built

Local home: `~/workspace/guardian-lab/railway-pattern-v2/`
Filed home: `04-guardian/railway-pattern-v2/` in the new repo (same files).

- `PATTERN.md` — v1 as verified from the original README + `vault-loader.js`
  (key lines quoted), the v2 shape beside it, weaknesses named, honesty tiers.
- `lib.js` — seal/open (AES-256-GCM), Shamir 2-of-3 split over GF(256),
  Walrus testnet blob leg (house endpoints, epochs=5; local stand-in
  fallback, honestly labeled), leader-packet builder.
- `pointer-service.js` — the v2 Railway analog: pointer records only.
- `demo.js` / `test.js` — end-to-end rehearsal + automated suite.
- `example-pointer-record.json` — the demo run's actual pointer record.
- The credential-store spec gained §9 (base pattern + v2 + test results):
  `~/workspace/blob-survival/CREDENTIAL-STORE-BLOB-SPEC-v0.1.md`.

## Test results (actually run, 2026-11-15)

- **Demo (real Walrus testnet leg):** dummy secret sealed → 182-byte packet
  stored on Walrus testnet, blob `mXjve-K19s6LOB0rL-hu4P1XbpAj6smVR-r4GRlSg44`
  (fingerprint `43e553b45cb57082c551d6f4b9aa060f61e2d2bc761c31771068c7a450f88afc`)
  → pointer recorded → packet fetched from the aggregator → fingerprint
  match **true** → opened with shares 1+3, byte-match **true**. (`demo-output.txt`)
- **Suite: 11 passed, 0 failed, exit 0** (`test-output.txt`): round-trip
  byte-match ×3 share pairs; wrong-key failure ×2 (foreign shares, corrupted
  share); below-threshold refusal (1 share); pointer-only service record
  (no plaintext / key hex / key base64 / any share / cipher present);
  tamper detection ×2 (fingerprint mismatch, GCM refusal); blob-leg
  round-trip (Walrus testnet, blob `ZFUdVm0i-2Vrn37SJ9zGsVwsK4ZvfC0WDy2ZLSnQpds`);
  proof honesty (`commitment`, never `snark`).

## Honesty tiers

- Blob leg: **real Walrus testnet**, twice (demo + suite). Testnet is the
  rehearsal tier — ephemeral by design; the honest tier for a real store is
  mainnet, behind David's exact word (spec §4). No mainnet, no spend: $0.
- Sui leader/anchor: **recorded, not fired** — nothing signed, nothing sent.
- Share homes + pointer service: **local stand-ins** proving the separation
  shape; real shelf/mirror placement is a gated build step.
- Secrets: **one invented dummy value only** (`dummy-test-value-0000-…`).
  No real credential, key, or share of anything real exists in this work.
  Share files and service state were deliberately NOT filed to the repo —
  the repo carries the pointer, the code, and the proof, per the pattern.
- Old Railway services and old GitHub repos: **not woken, not modified**.

## Blockers

None for the draft. Open by design (not blockers): AEGIS's half of the
credential-store spec (the split's exact production shape, the momentary
open) and the specialist-agreement + podcast gates before any final build.

## Filing

Filed into `gamemastersentertainment/koda-kai-network` under
`04-guardian/railway-pattern-v2/` in a single Git Data commit carrying this
receipt; every filed file verified by independent read-back from GitHub
(sha256 of served content vs local bytes). The commit SHA and the read-back
tally are reported to main with this receipt and recorded in the desk log —
a receipt cannot contain the hash of the commit that contains it.
