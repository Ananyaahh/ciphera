// app/api/auth/google/route.ts
// Verifies the ID token from Google Identity Services against Google's
// tokeninfo endpoint, confirming the audience matches OUR client id.
import { corsJson, corsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: Request) {
  if (!GOOGLE_CLIENT_ID) {
    return corsJson(
      { error: "Google login isn't configured on the server yet." },
      { status: 503 }
    );
  }

  let credential = "";
  try {
    const body = await req.json();
    credential = String(body?.credential ?? "").trim();
  } catch {
    return corsJson({ error: "Invalid request body." }, { status: 400 });
  }
  if (!credential) {
    return corsJson({ error: "Missing Google credential." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!res.ok) {
      return corsJson({ error: "Invalid Google token." }, { status: 401 });
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
      return corsJson({ error: "Token audience mismatch." }, { status: 401 });
    }
    const verified =
      payload.email_verified === true || payload.email_verified === "true";
    if (!payload.email || !verified || !payload.sub) {
      return corsJson({ error: "Unverified Google account." }, { status: 401 });
    }
    if (payload.exp && Date.now() / 1000 > Number(payload.exp)) {
      return corsJson({ error: "Google token expired." }, { status: 401 });
    }

    return corsJson({
      ok: true,
      googleSub: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
    });
  } catch (err: any) {
    return corsJson({ error: err?.message ?? "Google verification failed." }, { status: 502 });
  }
}
