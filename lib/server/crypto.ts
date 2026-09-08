// lib/server/crypto.ts
// Server-only mirror of a few functions from lib/crypto.ts and lib/ledger.ts,
// using Node's crypto module instead of the browser's Web Crypto global.
// This is a separate file so the existing client-side lib/crypto.ts and
// lib/ledger.ts stay completely untouched.

import { webcrypto } from "node:crypto";

function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function sha256Hex(data: string): Promise<string> {
  const buf = new TextEncoder().encode(data);
  const digest = await webcrypto.subtle.digest("SHA-256", buf as BufferSource);
  return bufToHex(digest);
}

export async function importPublicKeyJwk(jwk: JsonWebKey): Promise<any> {
  return webcrypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );
}

export async function verifyHex(
  publicKey: any,
  dataHex: string,
  signatureHex: string
): Promise<boolean> {
  return webcrypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    hexToBuf(signatureHex) as BufferSource,
    hexToBuf(dataHex) as BufferSource
  );
}

// Same formula as lib/ledger.ts's computeRecordHash, reimplemented here so
// the API routes can build/verify the hash chain server-side.
export async function computeRecordHash(
  index: number,
  type: string,
  payloadHash: string,
  signature: string,
  prevHash: string,
  timestamp: number
): Promise<string> {
  return sha256Hex(`${index}|${type}|${payloadHash}|${signature}|${prevHash}|${timestamp}`);
}
