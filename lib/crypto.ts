// lib/crypto.ts
// Browser-native cryptography (Web Crypto / SubtleCrypto) standing in for
// the paper's TEE-backed key attestation + HKDF chain. Everything here runs
// client-side; a production build would move signing into a real secure
// enclave and move the ledger + user store onto a server.

export function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function randomHex(byteLength: number): string {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return bufToHex(arr);
}

export function randomId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : randomHex(16);
}

export async function sha256Hex(
  data: ArrayBuffer | Uint8Array | string
): Promise<string> {
  const buf =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
      ? data
      : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", buf as BufferSource);
  return bufToHex(digest);
}

/** PBKDF2-based password hash. Demo-grade (client-side), not a substitute
 *  for a server-side auth service, but avoids storing plaintext. */
export async function hashPassword(
  password: string,
  saltHex?: string
): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? hexToBuf(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 150000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: bufToHex(bits), salt: bufToHex(salt) };
}

/** HKDF-Extract-and-Expand: combines the stable biometric-derived key
 *  material with per-image context (image hash, timestamp, nonce) into a
 *  key unique to exactly one photo (architecture §Layer 3). */
export async function hkdf(
  ikm: ArrayBuffer | Uint8Array,
  saltHex: string,
  infoStr: string,
  lengthBits = 256
): Promise<ArrayBuffer> {
  const ikmBytes = ikm instanceof Uint8Array ? ikm : new Uint8Array(ikm);
  const baseKey = await crypto.subtle.importKey("raw", ikmBytes as BufferSource, "HKDF", false, [
    "deriveBits",
  ]);
  const salt = hexToBuf(saltHex);
  const info = new TextEncoder().encode(infoStr);
  return crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    baseKey,
    lengthBits
  );
}

/** Generates a non-extractable ECDSA P-256 keypair. Storing a
 *  non-extractable CryptoKey in IndexedDB is the closest a browser gets to
 *  "the key never leaves secure hardware" -- our stand-in for TEE-backed
 *  device key attestation. */
export async function generateDeviceKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false, // non-extractable private key
    ["sign", "verify"]
  ) as Promise<CryptoKeyPair>;
}

export async function signHex(
  privateKey: CryptoKey,
  dataHex: string
): Promise<string> {
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    hexToBuf(dataHex) as BufferSource
  );
  return bufToHex(sig);
}

export async function verifyHex(
  publicKey: CryptoKey,
  dataHex: string,
  signatureHex: string
): Promise<boolean> {
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    hexToBuf(signatureHex) as BufferSource,
    hexToBuf(dataHex) as BufferSource
  );
}

export async function exportPublicKeyJwk(key: CryptoKey) {
  return crypto.subtle.exportKey("jwk", key);
}

export async function importPublicKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );
}

/** Short, human-shareable identity token derived from a user id -- this is
 *  what gets embedded in the robust watermark layer instead of raw PII. */
export async function deriveIdentityToken(userId: string): Promise<string> {
  const h = await sha256Hex(`ciphera:identity:${userId}`);
  return `CPH-${h.slice(0, 4).toUpperCase()}-${h.slice(4, 8).toUpperCase()}-${h
    .slice(8, 12)
    .toUpperCase()}`;
}
