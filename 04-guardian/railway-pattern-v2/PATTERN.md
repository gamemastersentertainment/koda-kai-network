# THE RAILWAY PATTERN — v1 (David's original) and the v2 update

**Tested draft — not a final build. Final builds gate on specialist agreement (AEGIS / Frontier / Guardian desk) and the podcast, per David's sequence (2026-11-15).**

Commission: David, 2026-11-15 — take the Railway pattern from the old Guardian
code, update it as an idea, *test it* (the old code "was never truly tested"),
and file it into the new GitHub (`gamemastersentertainment/koda-kai-network`)
as part of walking away from the old GitHub toward better-tested solutions.
Originals stay untouched, always: everything below about v1 is *quoted and
cited*, never edited; the v2 shape lives beside it as the labeled improvement.
This doc is also folded into the credential-store spec
(`CREDENTIAL-STORE-BLOB-SPEC-v0.1.md`, §9) as that spec's base pattern.

---

## 1. The v1 pattern, as verified in the original

Source: `masterledgerlive/guardian-protocol-agent` — README.md ("🔐 Blockchain
Key Vault", "The Vault System — Technical Detail") and `vault-loader.js`,
read 2026-11-15 from the local clone (GitHub HEAD 60fd4a16). Sibling services
on Railway: project `industrious-tranquility` → `guardian-protocol-agent` +
`StorageToken`; project `generous-solace` → an older `coinbase-agent`.

The key hierarchy, verbatim from the README:

```
DECRYPT_PASSWORD (in your head or Railway temporarily)
        ↓
AES-256-GCM encryption
        ↓
Encrypted blob → UTF-8 hex → EVM calldata
        ↓
Zero-value self-transaction → Base blockchain
        ↓
Transaction hash stored in Railway as VAULT_<KEYNAME>
```

And the boot sequence, verbatim:

> 1. Railway holds only **tx hashes** — the location of each secret on Base
> 2. Guardian fetches each encrypted blob from the blockchain
> 3. Decrypts in memory using a password you hold
> 4. Password is never stored — cleared immediately after use
> 5. Bot runs normally — Railway never saw the real keys

> "No actual secrets in Railway. Just addresses of where to find them."

> "Even if your cloud provider is fully compromised, an attacker gets nothing
> but a list of transaction hashes pointing to encrypted data they cannot read."

The code matches the doc: `vault-loader.js` inscribes ciphertext as
`[VAULT:v1:KEYNAME] <base64>` in calldata (`vaultEncryptAndInscribe`), loads
Railway-env first with blockchain fallback (`loadOneKey`), and decrypts with
AES-256-GCM in memory. The vault wallet never spends on storage; the pattern's
whole security claim is the *separation*: the hosted service holds pointers,
the chain holds cipher, the password lives in the operator's head.

**What v1 never had** (stated plainly, because David asked for tested over
assumed): no automated test ever ran this round-trip end to end — the vault's
own test surface was Telegram commands (`/vaulttest`) worked by hand. Two
weaknesses a 2026 rebuild must not inherit:

- **The KDF is one SHA-256 pass** — `deriveKey = sha256(password + salt)`
  (`vault-loader.js`). A single fast hash is a weak password stretcher; a
  leaked inscription plus a guessable password is a brute-force invitation.
- **The password is a single point** — one head, one secret, no threshold.
  Lose it and every inscription is a locked door; leak it and every
  inscription opens.

## 2. The v2 shape (the update — our design, David's rulings)

Same separation, modern legs, ruled custody. Design inputs are David's
2026-11-14 rulings on the credential store: **the blob is a lane, never the
vault**; **key custody is SPLIT** (below threshold = unrecoverable by design);
**the Railway mirror is a live recall leg, never an original**; new keys are
born with `proof_type = "commitment"` (SNARK slot reserved, not built).

| v1 (original) | v2 (this draft) |
|---|---|
| Password → SHA-256 KDF → AES key | Random 256-bit data key (no password KDF in the open path at all) |
| One password, in the operator's head | Data key **split 2-of-3** (Shamir over GF(256)); shares rest in separate homes; no home opens alone |
| Cipher inscribed in Base calldata (permanent, public chain) | Cipher packet rides a **Walrus blob** (portable lane, hash-verified on arrival) |
| Tx hash in a Railway env var (`VAULT_<KEYNAME>`) | **Leader packet** in the Guardian marker shape — `§$STORE§ §KEY§<name>§LOC§n=1\|h=<fingerprint>\|b=<blob id>` — recorded for the Sui anchor lane (follow-the-leader: the packet points, nobody searches) |
| Hosted service holds tx hashes only | Pointer service holds the **pointer record only** (fingerprint, size, blob id, leader, proof ref, split *shape* — never the split map, never a share) |
| No proof attached to a key's birth | Every key born with a **commitment proof**: `key_commitment` + `custody_commitment` in the record; `proof_type: "commitment"` until the SNARK slot truly exists |

The momentary open is unchanged in spirit: pointer → fetch cipher from the
blob leg → **fingerprint hash-match before anything opens it** → reconstruct
the key from a threshold of shares → decrypt in memory → the clear value
exists for that moment only → a recall receipt (fingerprint, leg, hash-match,
timestamp) that never contains the value or the key.

## 3. What was actually tested (2026-11-15, this draft)

Reference implementation beside this doc (`lib.js`, `pointer-service.js`,
`demo.js`, `test.js` — Node, built-in crypto only, dummy values only):

- **Demo round-trip on the real Walrus testnet leg**: a dummy secret was
  sealed, its 182-byte packet stored on Walrus testnet (blob
  `mXjve-K19s6LOB0rL-hu4P1XbpAj6smVR-r4GRlSg44`, epochs=5 via the house
  publisher endpoint), the pointer recorded, the packet fetched back from
  the aggregator, fingerprint-matched, and opened byte-exact with shares
  1+3 (the shelf share never touched).
- **11 automated tests, 11 passed, 0 failed** (`test-output.txt`): round-trip
  byte-match for all three share pairs; wrong-key failure (foreign shares;
  corrupted share); below-threshold refusal (1 share); pointer-only service
  record (asserted free of plaintext, key in hex/base64, every share, and
  the cipher); tamper detection (fingerprint mismatch; GCM refusal); blob-leg
  round-trip (Walrus testnet again); proof honesty (`commitment`, never
  `snark`).

**Honesty tiers — what this rehearsal is NOT:**

- The Sui leader/anchor was **recorded, not fired** — no transaction was
  signed or sent (mother core never signs; nothing spends in a rehearsal).
  Anchor status in the record: `DESIGNED-NOT-FIRED`.
- The three share "homes" (local / shelf / mirror) are **simulated as local
  files** in this rehearsal. Their separation is proven as a *shape* (no
  file holds cipher + share, the service holds neither); real shelf/mirror
  placement is the build step the specialists gate.
- The pointer service is a **local JSON stand-in** for the hosted service —
  the same discipline v1's Railway env block kept, without waking or touching
  the old Railway services (hard limit of this commission).
- Testnet is the rehearsal tier only (spec §4): ephemeral by design. The
  honest tier for a real store remains mainnet, behind David's exact word.

## 4. Where it goes next (David's sequence)

Design (this draft) → **specialist agreement** (AEGIS owns the split's exact
shape and the momentary open; Frontier owns legs/renewal; Guardian desk owns
the anchor lane) → **podcast** → final builds. Nothing here calls itself
final, and the old code it improves on stays byte-for-byte where it was.
