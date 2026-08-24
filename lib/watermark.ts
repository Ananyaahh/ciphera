// lib/watermark.ts
// Client-side stand-in for the paper's GAN-hardened dual watermark
// (architecture §Layer 3). Real robustness against JPEG re-encoding and
// AI-based removal needs a trained encoder/decoder pair running server-side
// or on-device via ML -- out of scope for a browser demo. What's
// implemented here is honest about that trade-off (see README) while still
// giving a working, self-consistent invisible mark:
//
//   Robust layer  -> payload bits repeated with redundancy across the red
//                    channel's LSBs, majority-vote decoded. Survives small
//                    amounts of noise; does not survive real JPEG re-encode.
//   Fragile layer -> a hash of the "neutral" image (robust layer embedded,
//                    fragile bit-plane zeroed) written into the blue
//                    channel's LSBs. Any pixel-level edit after embedding
//                    changes the recomputed hash and is caught deterministically.

import { sha256Hex } from "./crypto";
import type { WatermarkPayload } from "./types";

const ROBUST_REDUNDANCY = 10;
const FRAGILE_HASH_BYTES = 32; // sha-256

function bytesToBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }
  return bits;
}

function bitsToBytes(bits: number[]): Uint8Array {
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    out[i] = byte;
  }
  return out;
}

function uint32ToBytes(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = (n >>> 24) & 0xff;
  b[1] = (n >>> 16) & 0xff;
  b[2] = (n >>> 8) & 0xff;
  b[3] = n & 0xff;
  return b;
}

function bytesToUint32(b: Uint8Array): number {
  return (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3];
}

/** Writes one bit into a channel's LSB at pixel index `pixelIdx`. */
function setChannelLSB(
  pixels: Uint8ClampedArray,
  pixelIdx: number,
  channelOffset: number,
  bit: number
) {
  const i = pixelIdx * 4 + channelOffset;
  pixels[i] = (pixels[i] & 0xfe) | bit;
}

function getChannelLSB(
  pixels: Uint8ClampedArray,
  pixelIdx: number,
  channelOffset: number
): number {
  return pixels[pixelIdx * 4 + channelOffset] & 1;
}

const CHANNEL = { R: 0, G: 1, B: 2 } as const;

function capacityCheck(numPixels: number, neededBits: number) {
  if (neededBits > numPixels) {
    throw new Error(
      `Image too small to hold the watermark payload (need ${neededBits} px, have ${numPixels}). Use a larger capture resolution.`
    );
  }
}

/** Embeds the robust (redundant, majority-votable) payload layer. Mutates
 *  `pixels` in place and returns how many bits/pixels it used, so the
 *  fragile layer can be written after it without overlapping. */
function embedRobust(pixels: Uint8ClampedArray, payload: WatermarkPayload) {
  const json = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(json);
  const lengthBytes = uint32ToBytes(payloadBytes.length);
  const allBytes = new Uint8Array(lengthBytes.length + payloadBytes.length);
  allBytes.set(lengthBytes, 0);
  allBytes.set(payloadBytes, lengthBytes.length);

  const bits = bytesToBits(allBytes);
  const numPixels = pixels.length / 4;
  capacityCheck(numPixels, bits.length * ROBUST_REDUNDANCY);

  let px = 0;
  for (const bit of bits) {
    for (let r = 0; r < ROBUST_REDUNDANCY; r++) {
      setChannelLSB(pixels, px, CHANNEL.R, bit);
      px++;
    }
  }
  return { pixelsUsed: px };
}

function extractRobust(
  pixels: Uint8ClampedArray
): WatermarkPayload | null {
  try {
    // Decode the 32-bit length header first (with redundancy).
    const headerBits: number[] = [];
    let px = 0;
    for (let i = 0; i < 32; i++) {
      let ones = 0;
      for (let r = 0; r < ROBUST_REDUNDANCY; r++) {
        ones += getChannelLSB(pixels, px, CHANNEL.R);
        px++;
      }
      headerBits.push(ones * 2 >= ROBUST_REDUNDANCY ? 1 : 0);
    }
    const payloadLen = bytesToUint32(bitsToBytes(headerBits));
    if (payloadLen <= 0 || payloadLen > 20000) return null;

    const payloadBits: number[] = [];
    for (let i = 0; i < payloadLen * 8; i++) {
      let ones = 0;
      for (let r = 0; r < ROBUST_REDUNDANCY; r++) {
        ones += getChannelLSB(pixels, px, CHANNEL.R);
        px++;
      }
      payloadBits.push(ones * 2 >= ROBUST_REDUNDANCY ? 1 : 0);
    }
    const bytes = bitsToBytes(payloadBits);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as WatermarkPayload;
  } catch {
    return null;
  }
}

/** Fragile layer: hash the image with the fragile bit-plane neutralized
 *  (zeroed), then write that hash into the fragile bit-plane. Verification
 *  re-neutralizes and re-hashes; any pixel change anywhere flips the hash. */
async function embedFragile(pixels: Uint8ClampedArray): Promise<string> {
  const numPixels = pixels.length / 4;
  const fragileBitCount = FRAGILE_HASH_BYTES * 8;
  capacityCheck(numPixels, fragileBitCount);

  // Zero the fragile bit-plane first so hashing is reproducible.
  for (let px = 0; px < fragileBitCount; px++) {
    setChannelLSB(pixels, px, CHANNEL.B, 0);
  }
  const neutralHashHex = await sha256Hex(pixels as unknown as Uint8Array);
  const hashBytes = new Uint8Array(
    neutralHashHex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16))
  );
  const bits = bytesToBits(hashBytes);
  for (let px = 0; px < bits.length; px++) {
    setChannelLSB(pixels, px, CHANNEL.B, bits[px]);
  }
  return neutralHashHex;
}

async function verifyFragile(pixels: Uint8ClampedArray): Promise<{
  intact: boolean;
  claimedHash: string;
  recomputedHash: string;
}> {
  const fragileBitCount = FRAGILE_HASH_BYTES * 8;
  const claimedBits: number[] = [];
  for (let px = 0; px < fragileBitCount; px++) {
    claimedBits.push(getChannelLSB(pixels, px, CHANNEL.B));
  }
  const claimedHash = bufToHexLocal(bitsToBytes(claimedBits));

  const neutral = new Uint8ClampedArray(pixels);
  for (let px = 0; px < fragileBitCount; px++) {
    setChannelLSB(neutral, px, CHANNEL.B, 0);
  }
  const recomputedHash = await sha256Hex(neutral as unknown as Uint8Array);
  return { intact: claimedHash === recomputedHash, claimedHash, recomputedHash };
}

function bufToHexLocal(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface EmbedResult {
  imageData: ImageData;
  fragileHash: string;
}

/** Embeds both watermark layers into a canvas ImageData buffer (mutates a
 *  clone, does not mutate the input). */
export async function embedWatermark(
  source: ImageData,
  payload: WatermarkPayload
): Promise<EmbedResult> {
  const pixels = new Uint8ClampedArray(source.data);
  embedRobust(pixels, payload);
  const fragileHash = await embedFragile(pixels);
  return {
    imageData: new ImageData(pixels, source.width, source.height),
    fragileHash,
  };
}

export interface ExtractResult {
  payload: WatermarkPayload | null;
  fragileIntact: boolean;
  claimedHash: string;
  recomputedHash: string;
}

export async function extractWatermark(
  source: ImageData
): Promise<ExtractResult> {
  const pixels = new Uint8ClampedArray(source.data);
  const payload = extractRobust(pixels);
  const fragile = await verifyFragile(pixels);
  return {
    payload,
    fragileIntact: fragile.intact,
    claimedHash: fragile.claimedHash,
    recomputedHash: fragile.recomputedHash,
  };
}
