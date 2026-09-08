// app/api/verify/route.ts
// Given a watermark payload extracted from an image (done client-side,
// since that needs raw pixel access), confirms it against the SHARED
// ledger: who captured it, whether the signature/chain check out.

import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { ledgerRecords, users, devices } from "@/lib/server/schema";
import { eq, asc } from "drizzle-orm";
import { sha256Hex, importPublicKeyJwk, verifyHex, computeRecordHash } from "@/lib/server/crypto";

export const runtime = "nodejs";

const GENESIS_HASH = "0".repeat(64);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { payload, fragileIntact } = body ?? {};

    if (!payload) {
      return NextResponse.json({
        status: "unverifiable", identityToken: null, username: null, capturedAt: null,
        epochNumber: null, epochStatus: null, ledgerMatch: false, fragileIntact: !!fragileIntact,
        geo: null, details: "No CIPHERA watermark could be recovered from this image.",
      });
    }

    const payloadHash = await sha256Hex(JSON.stringify(payload));
    const [record] = await db.select().from(ledgerRecords).where(eq(ledgerRecords.payloadHash, payloadHash));
    const [user] = record ? await db.select().from(users).where(eq(users.id, record.userId)) : [];

    if (!record || !user) {
      return NextResponse.json({
        status: "unverifiable",
        identityToken: payload.identityToken ?? null,
        username: user?.username ?? null,
        capturedAt: payload.capturedAt ?? null,
        epochNumber: payload.epochNumber ?? null,
        epochStatus: null, ledgerMatch: false, fragileIntact: !!fragileIntact, geo: null,
        details: "A watermark payload was found, but no matching anchor exists in the shared provenance ledger.",
      });
    }

    const userDevices = await db.select().from(devices).where(eq(devices.userId, user.id));
    let signatureOk = false;
    for (const d of userDevices) {
      try {
        const pubKey = await importPublicKeyJwk(d.publicKeyJwk as JsonWebKey);
        if (await verifyHex(pubKey, record.payloadHash, record.signature)) {
          signatureOk = true;
          break;
        }
      } catch {}
    }

    const allRecords = await db.select().from(ledgerRecords).orderBy(asc(ledgerRecords.index));
    let prevHash = GENESIS_HASH;
    let chainOk = true;
    for (const r of allRecords) {
      if (r.prevHash !== prevHash) { chainOk = false; break; }
      const expected = await computeRecordHash(r.index, r.type, r.payloadHash, r.signature, r.prevHash, r.timestamp);
      if (expected !== r.hash) { chainOk = false; break; }
      prevHash = r.hash;
    }

    const geo = payload.geo ?? null;

    if (!fragileIntact) {
      return NextResponse.json({
        status: "tampered", identityToken: payload.identityToken, username: user.username,
        capturedAt: payload.capturedAt, epochNumber: payload.epochNumber, epochStatus: null,
        ledgerMatch: true, fragileIntact: false, geo,
        details: "The capturer and shared ledger anchor check out, but the fragile tamper-evidence layer has broken -- this image was edited since capture.",
      });
    }

    if (!signatureOk || !chainOk) {
      return NextResponse.json({
        status: "unverifiable", identityToken: payload.identityToken, username: user.username,
        capturedAt: payload.capturedAt, epochNumber: payload.epochNumber, epochStatus: null,
        ledgerMatch: true, fragileIntact: true, geo,
        details: !chainOk
          ? "The shared provenance ledger has been tampered with."
          : "The ledger anchor exists but its signature does not verify.",
      });
    }

    return NextResponse.json({
      status: "verified", identityToken: payload.identityToken, username: user.username,
      capturedAt: payload.capturedAt, epochNumber: payload.epochNumber, epochStatus: null,
      ledgerMatch: true, fragileIntact: true, geo,
      details: "Capturer identity, shared ledger anchor, and pixel integrity all check out.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Verification failed." }, { status: 500 });
  }
}
