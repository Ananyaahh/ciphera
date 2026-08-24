// app/api/auth/google/route.ts
// Verifies the ID token returned by Google Identity Services (the
// "Continue with Google" button). We validate it server-side against
// Google's tokeninfo endpoint and confirm the audience matches OUR
// client ID, so a token minted for some other site can't be replayed here.
//
// For higher volume / production you'd verify the JWT signature locally
// with google-auth-library instead of calling tokeninfo, but this is
// dependency-free and correct for a demo / low volume.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

export async function POST(req: Request) {
  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: "Google login isn't configured on the server yet." },
      { status: 503 }
    );
  }

  let credential = "";
  try {
    const body = await req.json();
    credential = String(body?.credential ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!credential) {
    return NextResponse.json({ error: "Missing Google credential." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!res.ok) {
      return NextResponse.json({ error: "Invalid Google token." }, { status: 401 });
    }
    const payload = (await res.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string | boolean;
      sub?: string;
      name?: string;
      exp?: string;
    };

    if (payload.aud !== GOOGLE_CLIENT_ID) {
      return NextResponse.json({ error: "Token audience mismatch." }, { status: 401 });
    }
    const verified =
      payload.email_verified === true || payload.email_verified === "true";
    if (!payload.email || !verified || !payload.sub) {
      return NextResponse.json({ error: "Unverified Google account." }, { status: 401 });
    }
    if (payload.exp && Date.now() / 1000 > Number(payload.exp)) {
      return NextResponse.json({ error: "Google token expired." }, { status: 401 });
    }

    // Identity confirmed. Hand the client the minimal profile it needs to
    // create-or-load a local Ciphera user.
    return NextResponse.json({
      ok: true,
      googleSub: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Google verification failed." },
      { status: 502 }
    );
  }
}
