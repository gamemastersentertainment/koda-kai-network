# Railway Pattern v2 — reference implementation (TESTED DRAFT)

**Tested draft — not a final build. Final builds gate on specialist agreement (AEGIS / Frontier / Guardian desk) and the podcast, per David's sequence (2026-11-15).**

The updated Guardian Vault pattern: the pointer service holds ONLY the
pointer; the cipher rides a Walrus blob; the key is split 2-of-3 and never
shares a leg with the cipher. Read `PATTERN.md` first — v1 as verified from
David's original Guardian code, the v2 shape beside it, and the honesty
tiers. `RECEIPT.md` is the run receipt.

## Run it (dummy values only — never point this at a real credential)

```sh
node demo.js   # end-to-end rehearsal: seal → blob → split → pointer → recall → open
node test.js   # 11 automated tests; exit 0 = all pass
```

- `lib.js` — seal/open (AES-256-GCM), Shamir split/combine over GF(256),
  Walrus testnet blob leg (house publisher/aggregator endpoints, epochs=5)
  with an honestly labeled local stand-in fallback, leader-packet builder.
- `pointer-service.js` — the v2 Railway analog: records and serves pointer
  records only (fingerprint, blob id, leader packet, proof ref, split shape).
- `example-pointer-record.json` — the actual pointer record from the demo run
  (blob `mXjve-K19s6LOB0rL-hu4P1XbpAj6smVR-r4GRlSg44`, Walrus testnet).

Node ≥ 18, built-in modules only, no dependencies. Free lanes only: local +
testnet. The Sui anchor is recorded, not fired — nothing here signs or spends.
