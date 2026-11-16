// End-to-end rehearsal of the v2 Railway pattern with a DUMMY secret.
// Run: node demo.js
// TESTED DRAFT — not a final build (David's sequence, 2026-11-15).

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sealSecret, openSecret, putBlob, getBlob, leaderPacket, sha256 } from "./lib.js";
import { recordPointer, getPointer, buildPointerRecord } from "./pointer-service.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEY_NAME = "DEMO_API_KEY";
const DUMMY = "dummy-test-value-0000-NOT-A-REAL-SECRET";
const LEG_HOMES = ["local", "shelf-kodakai", "mirror-railway"]; // simulated separate homes

const log = (...a) => console.log(...a);

log("═══ GUARDIAN VAULT v2 — rehearsal (dummy value only) ═══\n");

// 1. Seal: random data key, AES-256-GCM, key split 2-of-3.
const sealed = sealSecret(DUMMY, KEY_NAME);
log(`1. sealed "${KEY_NAME}" — packet ${sealed.packetBytes.length} B, fingerprint ${sealed.fingerprint.slice(0, 16)}…`);
log(`   data key split 2-of-3 (Shamir/GF256); proof_type = ${sealed.proof.proof_type}`);

// 2. Packet rides the blob leg. The key never touches this leg.
const blob = await putBlob(sealed.packetBytes);
log(`2. packet stored on blob leg: ${blob.leg}, blob_id ${blob.blob_id}`);

// 3. Shares rest in separate homes — one share each, never with the cipher.
for (let i = 0; i < sealed.shares.length; i++) {
  const home = path.join(HERE, "legs", `share-${i + 1}-${LEG_HOMES[i]}.json`);
  await fs.writeFile(home, JSON.stringify({
    key_name: KEY_NAME, share_id: sealed.shares[i].share_id,
    share_fingerprint: sealed.shares[i].fingerprint, data: sealed.shares[i].data,
  }, null, 2) + "\n");
}
log(`3. shares placed: ${LEG_HOMES.join(" / ")} — one share per home, cipher in none of them`);

// 4. The pointer service records ONLY the pointer (the v1 Railway move).
const leader = leaderPacket(KEY_NAME, sealed.fingerprint, blob.blob_id);
const record = buildPointerRecord({
  keyName: KEY_NAME, keyClass: "api-key", fingerprint: sealed.fingerprint,
  size: sealed.packetBytes.length, blob, leader, proof: sealed.proof,
});
await recordPointer(record);
log(`4. pointer recorded by the service — fingerprint + blob id + leader packet, nothing else`);
log(`   leader: ${leader}`);

// 5. Recall, the momentary open: pointer → fetch → hash-match → open → gone.
const ptr = await getPointer(KEY_NAME);
const fetched = await getBlob(ptr.blob_lane.blob_id, ptr.blob_lane.leg);
const match = sha256(fetched) === ptr.fingerprint;
log(`5. recall: fetched ${fetched.length} B from ${ptr.blob_lane.leg}; fingerprint match = ${match}`);
if (!match) throw new Error("fingerprint mismatch — refuse to open");
const shareObjs = [];
for (const home of ["share-1-local.json", "share-3-mirror-railway.json"]) // any 2 of 3
  shareObjs.push(JSON.parse(await fs.readFile(path.join(HERE, "legs", home), "utf8")));
const opened = openSecret(fetched, shareObjs);
log(`   opened with shares 1+3 (shelf share never touched): byte-match = ${opened === DUMMY}`);

log("\n═══ rehearsal complete — the service held a pointer, the blob held cipher,");
log("    the homes held one share each, and no leg could open anything alone. ═══");
