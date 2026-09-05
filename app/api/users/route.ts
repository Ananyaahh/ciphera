// app/api/users/route.ts
// Creates a CIPHERA account in the real backend (replaces the localStorage
// version of createAccount for multi-device use). Does not touch
// lib/auth.ts yet — that wiring happens in the next step, once this route
// is confirmed working on its own.

import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, passwordHash, passwordSalt, identityToken } = body ?? {};

    if (!username || !passwordHash || !passwordSalt || !identityToken) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "That username is already registered." },
        { status: 409 }
      );
    }

    const [user] = await db
      .insert(users)
      .values({ username, passwordHash, passwordSalt, identityToken })
      .returning();

    return NextResponse.json({ user });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Could not create account." },
      { status: 500 }
    );
  }
}
