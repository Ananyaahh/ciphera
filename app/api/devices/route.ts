// app/api/devices/route.ts
// Registers a device's PUBLIC signing key against a user in the shared
// backend. Private keys never leave the device -- this only ever receives
// the public half.

import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { devices } from "@/lib/server/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, publicKeyJwk, webauthnCredentialId, label } = body ?? {};
    if (!userId || !publicKeyJwk) {
      return NextResponse.json({ error: "Missing userId or publicKeyJwk." }, { status: 400 });
    }
    const [device] = await db
      .insert(devices)
      .values({ userId, publicKeyJwk, webauthnCredentialId, label })
      .returning();
    return NextResponse.json({ device });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Could not register device." }, { status: 500 });
  }
}
