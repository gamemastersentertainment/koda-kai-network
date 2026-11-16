// Automated tests for the v2 Railway pattern reference implementation.
// Run: node test.js   (exit code 0 = all pass)
// TESTED DRAFT — not a final build (David's sequence, 2026-11-15).

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sealSecret, openSecret, putBlob, getBlob, sha256 } from "./lib.js";
import { recordPointer, buildPointerRecord } from "./pointer-service.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLAIN = "dummy-test-value-0000-NOT-A-REAL-SECRET";

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log(`PASS  ${name}`); }
  catch (e) { fail++; console.log(`FAIL  ${name} — ${e.message}`); }
}
async function acheck(name, fn) {
  try { await fn(); pass++; console.log(`PASS  ${name}`); }
  catch (e) { fail++; console.log(`FAIL  ${name} — ${e.message}`); }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const throws = (fn, msg) => { try { fn(); } catch { return; } throw new Error(msg); };

// 1. Round-trip byte-match, every share pair.
{
  const s = sealSecret(PLAIN, "T_ROUNDTRIP");
  for (const pair of [[0, 1], [0, 2], [1, 2]]) {
    check(`round-trip byte-match with shares ${pair[0] + 1}+${pair[1] + 1}`, () => {
      assert(openSecret(s.packetBytes, pair.map((i) => s.shares[i])) === PLAIN, "plaintext mismatch");
    });
  }
}

// 2. Wrong key: shares from a different seal must fail (GCM refuses).
check("wrong-key failure (foreign shares)", () => {
  const a = sealSecret(PLAIN, "T_WRONGKEY_A");
  const b = sealSecret(PLAIN, "T_WRONGKEY_B");
  throws(() => openSecret(a.packetBytes, [b.shares[0], b.shares[1]]), "foreign shares opened the packet");
});

// 2b. Corrupted share byte must fail too.
check("wrong-key failure (corrupted share)", () => {
  const s = sealSecret(PLAIN, "T_CORRUPT");
  const bad = { ...s.shares[0], data: Buffer.from((() => { const b = Buffer.from(s.shares[0].data, "base64"); b[5] ^= 0xff; return b; })()).toString("base64") };
  throws(() => openSecret(s.packetBytes, [bad, s.shares[1]]), "corrupted share opened the packet");
});

// 3. Below threshold: a single share cannot open — unrecoverable by design.
check("below-threshold refusal (1 share)", () => {
  const s = sealSecret(PLAIN, "T_THRESHOLD");
  throws(() => openSecret(s.packetBytes, [s.shares[0]]), "one share opened the packet");
});

// 4. Pointer-only service record: no key, no share, no cipher, no plaintext.
await acheck("pointer service record holds no key / share / cipher / plaintext", async () => {
  const s = sealSecret(PLAIN, "T_POINTER");
  const blob = { blob_id: "test-blob-id", leg: "local-standin" };
  const rec = buildPointerRecord({
    keyName: "T_POINTER", keyClass: "api-key", fingerprint: s.fingerprint,
    size: s.packetBytes.length, blob, leader: "§TEST§", proof: s.proof,
  });
  await recordPointer(rec);
  const raw = await fs.readFile(path.join(HERE, "service", "pointers.json"), "utf8");
  const packet = JSON.parse(s.packetBytes.toString("utf8"));
  const forbidden = [
    ["plaintext", PLAIN],
    ["plaintext (base64)", Buffer.from(PLAIN).toString("base64")],
    ["data key (hex)", s._dataKeyHex],
    ["data key (base64)", Buffer.from(s._dataKeyHex, "hex").toString("base64")],
    ["cipher (base64)", packet.cipher],
    ...s.shares.map((sh, i) => [`share ${i + 1} data`, sh.data]),
  ];
  for (const [label, needle] of forbidden)
    assert(!raw.includes(needle), `service record contains ${label}`);
  assert(rec.proof_type === "commitment", "proof_type is not commitment");
});

// 5. Tamper detection: flipped byte breaks the fingerprint AND the GCM tag.
check("tamper detection (fingerprint mismatch)", () => {
  const s = sealSecret(PLAIN, "T_TAMPER_FP");
  const tampered = Buffer.from(s.packetBytes); tampered[tampered.length - 5] ^= 0x01;
  assert(sha256(tampered) !== s.fingerprint, "tampered packet kept the same fingerprint");
});
check("tamper detection (GCM refuses tampered cipher)", () => {
  const s = sealSecret(PLAIN, "T_TAMPER_GCM");
  const packet = JSON.parse(s.packetBytes.toString("utf8"));
  const ct = Buffer.from(packet.cipher, "base64"); ct[0] ^= 0x01; packet.cipher = ct.toString("base64");
  throws(() => openSecret(Buffer.from(JSON.stringify(packet)), [s.shares[0], s.shares[1]]),
    "tampered cipher decrypted");
});

// 6. Blob leg round-trip (whichever leg answers: testnet or labeled stand-in).
await acheck("blob leg round-trip", async () => {
  const s = sealSecret(PLAIN, "T_BLOB");
  const put = await putBlob(s.packetBytes);
  const got = await getBlob(put.blob_id, put.leg);
  assert(got.equals(s.packetBytes), `blob round-trip mismatch on leg ${put.leg}`);
  console.log(`      (blob leg used: ${put.leg}, blob_id ${put.blob_id})`);
});

// 7. Proof honesty: the record can never claim a SNARK that does not exist.
check("proof honesty (commitment, never snark)", () => {
  const s = sealSecret(PLAIN, "T_PROOF");
  assert(s.proof.proof_type === "commitment", "proof_type drifted from commitment");
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
