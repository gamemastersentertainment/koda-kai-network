// ═══════════════════════════════════════════════════════════════════════════════
// POINTER SERVICE — the v2 analog of v1's Railway env block.
//
// v1: Railway env vars held VAULT_<KEYNAME> = a Base tx hash. Nothing else.
// v2: this service holds one pointer record per key: the pack's fingerprint,
// its blob id, the leader packet, the proof reference, the split's shape.
// It NEVER holds: the cipher, the data key, any key share, any clear value.
// "No actual secrets in Railway. Just addresses of where to find them." — v1.
//
// TESTED DRAFT — not a final build (David's sequence, 2026-11-15).
// Local JSON file stands in for the hosted service in this rehearsal.
// ═══════════════════════════════════════════════════════════════════════════════

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.join(HERE, "service", "pointers.json");

async function loadAll() {
  try { return JSON.parse(await fs.readFile(STORE, "utf8")); }
  catch { return {}; }
}

export async function recordPointer(record) {
  const all = await loadAll();
  all[record.key_name] = record;
  await fs.mkdir(path.dirname(STORE), { recursive: true });
  await fs.writeFile(STORE, JSON.stringify(all, null, 2) + "\n");
  return record;
}

export async function getPointer(keyName) {
  const all = await loadAll();
  const rec = all[keyName];
  if (!rec) throw new Error("no pointer for " + keyName);
  return rec;
}

// The record shape — the only thing any service or repo ever sees.
// Mirrors §5 of the credential-store spec: a map to ciphertext and proofs.
export function buildPointerRecord({ keyName, keyClass, fingerprint, size, blob, leader, proof }) {
  return {
    service_label: "railway-pattern-v2-rehearsal",
    key_name: keyName,
    key_class: keyClass,                       // password | api-key | chain-key
    fingerprint,                               // sha256 of the cipher packet
    size,                                      // exact bytes of the cipher packet
    blob_lane: { blob_id: blob.blob_id, leg: blob.leg, tier: "testnet-rehearsal" },
    leader_packet: leader,                     // follow-the-leader marker (recorded, not fired)
    anchor: { chain: "sui-testnet", status: "DESIGNED-NOT-FIRED in this rehearsal" },
    split: { threshold: 2, shares: 3, map_in_record: false }, // shape only — never the map
    proof_type: proof.proof_type,              // "commitment" — never "snark" until the slot exists
    proof_ref: { key_commitment: proof.key_commitment, custody_commitment: proof.custody_commitment },
    created: "2026-11-15",
  };
}
