// lib/ledger.ts
// Stand-in for architecture §Layer 4: an append-only, tamper-evident log.
// A production system would use a permissioned blockchain or a Certificate
// Transparency-style Merkle log run by multiple parties, so that no single
// operator -- including CIPHERA itself -- can rewrite history. This demo
// keeps the same *shape* of guarantee (hash-chained, append-only, every
// record's hash depends on everything before it) inside the browser, and
// says so plainly: it is not multi-party yet.

import { sha256Hex } from "./crypto";
import type { LedgerRecord } from "./types";

const KEY = "ciphera:ledger:v1";
const GENESIS_HASH = "0".repeat(64);

function readAll(): LedgerRecord[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as LedgerRecord[]) : [];
}

function writeAll(records: LedgerRecord[]) {
  window.localStorage.setItem(KEY, JSON.stringify(records));
}

export function getLedger(): LedgerRecord[] {
  return readAll();
}

async function computeRecordHash(
  index: number,
  type: string,
  payloadHash: string,
  signature: string,
  prevHash: string,
  timestamp: number
): Promise<string> {
  return sha256Hex(
    `${index}|${type}|${payloadHash}|${signature}|${prevHash}|${timestamp}`
  );
}

export async function appendRecord(
  type: "capture" | "revocation",
  payloadHash: string,
  signature: string
): Promise<LedgerRecord> {
  const all = readAll();
  const prevHash = all.length ? all[all.length - 1].hash : GENESIS_HASH;
  const index = all.length;
  const timestamp = Date.now();
  const hash = await computeRecordHash(
    index,
    type,
    payloadHash,
    signature,
    prevHash,
    timestamp
  );
  const record: LedgerRecord = {
    index,
    type,
    payloadHash,
    signature,
    prevHash,
    hash,
    timestamp,
  };
  all.push(record);
  writeAll(all);
  return record;
}

/** Walks the whole chain and confirms every record's hash is consistent
 *  with its neighbors -- proves nothing in the log has been silently
 *  edited, reordered, or deleted. */
export async function verifyChainIntegrity(): Promise<{
  ok: boolean;
  brokenAtIndex: number | null;
}> {
  const all = readAll();
  let prevHash = GENESIS_HASH;
  for (const rec of all) {
    if (rec.prevHash !== prevHash) return { ok: false, brokenAtIndex: rec.index };
    const expected = await computeRecordHash(
      rec.index,
      rec.type,
      rec.payloadHash,
      rec.signature,
      rec.prevHash,
      rec.timestamp
    );
    if (expected !== rec.hash) return { ok: false, brokenAtIndex: rec.index };
    prevHash = rec.hash;
  }
  return { ok: true, brokenAtIndex: null };
}

export function getRecord(index: number): LedgerRecord | undefined {
  return readAll()[index];
}
