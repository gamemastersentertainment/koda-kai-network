// ═══════════════════════════════════════════════════════════════════════════════
// GUARDIAN VAULT — v2 reference implementation (TESTED DRAFT, 2026-11-15)
//
// The updated Railway pattern: the pointer service holds ONLY the pointer.
//   v1 (David's original, guardian-protocol-agent): password -> AES-256-GCM ->
//     cipher as UTF-8 calldata in a zero-value self-tx on Base -> the tx hash
//     sits in Railway as VAULT_<KEYNAME>. Railway never saw the real keys.
//   v2 (this draft): random data key -> AES-256-GCM -> cipher packet rides a
//     Walrus blob -> a leader packet (Sui marker shape) points at it -> the
//     data key is SPLIT (Shamir, threshold) across legs, per David's ruled
//     SPLIT custody: key and cipher never share a leg, no leg opens alone.
//
// TESTED DRAFT — not a final build. Final builds gate on specialist agreement
// (AEGIS / Frontier / Guardian desk) and the podcast, per David's sequence
// (2026-11-15). Dummy values only. No real credential is ever handled here.
// ═══════════════════════════════════════════════════════════════════════════════

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const b64 = (buf) => Buffer.from(buf).toString("base64");
const unb64 = (s) => Buffer.from(s, "base64");

// ── Shamir secret sharing over GF(256), threshold-of-n ───────────────────────
// Polynomial 0x11b (the AES field). Shares are Buffers: [x, ...y-bytes].

const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x ^= ((x << 1) & 0xff) ^ (x & 0x80 ? 0x1b : 0); // multiply by 2 in GF(256)
    x &= 0xff;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const gmul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;
const gdiv = (a, b) => EXP[LOG[a] - LOG[b] + 255];

export function splitKey(secret, threshold = 2, n = 3) {
  if (threshold > n) throw new Error("threshold exceeds share count");
  const shares = Array.from({ length: n }, (_, i) => [i + 1]);
  for (let byteIdx = 0; byteIdx < secret.length; byteIdx++) {
    const coeffs = [secret[byteIdx]];
    for (let k = 1; k < threshold; k++) coeffs.push(randomBytes(1)[0]);
    for (let s = 0; s < n; s++) {
      const x = s + 1;
      let y = 0;
      for (let k = coeffs.length - 1; k >= 0; k--) y = gmul(y, x) ^ coeffs[k];
      shares[s].push(y);
    }
  }
  return shares.map((arr) => Buffer.from(arr));
}

export function combineShares(shares, threshold = 2) {
  if (shares.length < threshold)
    throw new Error(`below threshold: ${shares.length} share(s), need ${threshold} — unrecoverable by design`);
  const len = shares[0].length - 1;
  const out = Buffer.alloc(len);
  for (let byteIdx = 0; byteIdx < len; byteIdx++) {
    let acc = 0;
    for (let i = 0; i < shares.length; i++) {
      const xi = shares[i][0], yi = shares[i][byteIdx + 1];
      let num = 1, den = 1;
      for (let j = 0; j < shares.length; j++) {
        if (j === i) continue;
        const xj = shares[j][0];
        num = gmul(num, xj);          // (0 - xj) = xj in GF(256)
        den = gmul(den, xi ^ xj);     // (xi - xj) = xi ^ xj
      }
      acc ^= gmul(yi, gdiv(num, den));
    }
    out[byteIdx] = acc;
  }
  return out;
}

// ── Seal / open ───────────────────────────────────────────────────────────────
// seal: random 32-byte data key, AES-256-GCM (v1's cipher, kept), packet is
// the cipher object that rides the blob leg. The data key never touches the
// packet's leg: it leaves only as Shamir shares.

export function sealSecret(plaintext, keyName) {
  const dataKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const packet = {
    format: "guardian-vault-v2",
    key_name: keyName,
    iv: b64(iv),
    auth_tag: b64(cipher.getAuthTag()),
    cipher: b64(ct),
  };
  const packetBytes = Buffer.from(JSON.stringify(packet), "utf8");
  const shares = splitKey(dataKey, 2, 3);
  return {
    packetBytes,
    fingerprint: sha256(packetBytes),
    shares: shares.map((s, i) => ({ share_id: i + 1, data: b64(s), fingerprint: sha256(s) })),
    // Commitment proof (honesty tier: commitment, NOT snark — the SNARK slot
    // is reserved and not built; a record claiming snark today is false).
    proof: {
      proof_type: "commitment",
      key_commitment: sha256(dataKey),
      custody_commitment: sha256(Buffer.from(shares.map((s) => sha256(s)).sort().join("|"))),
    },
    // Exposed to the caller ONLY so tests can assert the service record and
    // the legs never contain it. Production callers must drop it immediately.
    _dataKeyHex: dataKey.toString("hex"),
  };
}

export function openSecret(packetBytes, shareObjs) {
  const packet = JSON.parse(Buffer.from(packetBytes).toString("utf8"));
  if (packet.format !== "guardian-vault-v2") throw new Error("unrecognized packet format");
  const dataKey = combineShares(shareObjs.map((s) => unb64(s.data)), 2);
  const decipher = createDecipheriv("aes-256-gcm", dataKey, unb64(packet.iv));
  decipher.setAuthTag(unb64(packet.auth_tag));
  // GCM auth failure throws here — wrong key or tampered cipher, both refuse.
  return Buffer.concat([decipher.update(unb64(packet.cipher)), decipher.final()]).toString("utf8");
}

// ── Blob leg ──────────────────────────────────────────────────────────────────
// Primary: Walrus testnet (house endpoints, epochs=5 like the house scripts).
// Fallback: local blob-store stand-in — honestly labeled, never disguised.

const PUBLISHER = "https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=5";
const AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space/v1/blobs/";

export async function putBlob(bytes) {
  try {
    const res = await fetch(PUBLISHER, {
      method: "PUT", body: bytes, signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      const j = await res.json();
      const blobId = j?.newlyCreated?.blobObject?.blobId ?? j?.alreadyCertified?.blobId;
      if (blobId) return { blob_id: blobId, leg: "walrus-testnet" };
    }
  } catch { /* fall through to the stand-in */ }
  const blobId = "local-" + createHash("sha256").update(bytes).digest("base64url");
  await fs.writeFile(path.join(HERE, "blob-store", blobId), bytes);
  return { blob_id: blobId, leg: "local-standin" };
}

export async function getBlob(blobId, leg) {
  if (leg === "walrus-testnet") {
    const res = await fetch(AGGREGATOR + blobId, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error("aggregator fetch failed: HTTP " + res.status);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFile(path.join(HERE, "blob-store", blobId));
}

// ── Leader packet (follow-the-leader) ─────────────────────────────────────────
// The marker shape the Guardian lane already fires on Sui testnet. In this
// rehearsal the packet is RECORDED, not fired — nothing signs, nothing spends.

export function leaderPacket(keyName, fingerprint, blobId) {
  return `§$STORE§ §KEY§${keyName}§LOC§n=1|h=${fingerprint}|b=${blobId}`;
}
