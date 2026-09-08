// app/api/captures/route.ts
// Anchors a capture to the SHARED provenance ledger (Postgres), instead of
// each device only anchoring to its own local ledger. This is what lets a
// different device look this capture up later.

import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { ledgerRecords, captures } from "@/lib/server/schema";
import { desc } from "drizzle-orm";
import { computeRecordHash } from "@/lib/server/crypto";

export const runtime = "nodejs";

const GENESIS_HASH = "0".repeat(64);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      userId, epochNumber, imageHash, fragileHash,
      width, height, capturedAt, geo, payloadHash, signature,
    } = body ?? {};

    if (!userId || !payloadHash || !signature || !imageHash) {
      return NextResponse.json({ error: "Missing required capture fields." }, { status: 400 });
    }

    const [last] = await db
      .select()
      .from(ledgerRecords)
      .orderBy(desc(ledgerRecords.index))
      .limit(1);

    const prevHash = last?.hash ?? GENESIS_HASH;
    const index = last ? last.index + 1 : 0;
    const timestamp = Date.now();
    const hash = await computeRecordHash(index, "capture", payloadHash, signature, prevHash, timestamp);

    await db.insert(ledgerRecords).values({
      index, type: "capture", userId,
      payloadHash, signature, prevHash, hash, timestamp,
    });

    await db.insert(captures).values({
      userId,
      ledgerIndex: index,
      epochNumber: epochNumber ?? 0,
      imageHash,
      fragileHash: fragileHash ?? "",
      width: width ?? 0,
      height: height ?? 0,
      capturedAt: new Date(capturedAt ?? Date.now()),
      geoLat: geo?.lat ?? null,
      geoLng: geo?.lng ?? null,
      geoAccuracy: geo?.accuracy ?? null,
      geoCapturedAt: geo?.capturedAt ? new Date(geo.capturedAt) : null,
    });

    return NextResponse.json({ ok: true, ledgerIndex: index });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Could not register capture." }, { status: 500 });
  }
}
