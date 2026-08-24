// lib/otpServer.ts
// Server-only helpers for phone OTP. Two modes:
//   1. LIVE  — if Twilio Verify env vars are set, real SMS codes are sent and
//              checked by Twilio (Twilio stores/expires/rate-limits the code).
//   2. DEMO  — if they're NOT set, a code is generated + kept in memory so the
//              flow still works locally without any provider. The code is
//              returned to the client so the existing on-screen hint keeps
//              working. NEVER ship DEMO mode to production.
//
// This file must only ever be imported from server code (API routes).

import "server-only";

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SERVICE_SID,
} = process.env;

export function isLiveOtp(): boolean {
  return Boolean(
    TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID
  );
}

// ---- DEMO in-memory store (dev only; resets when the server restarts) ----
type DemoRecord = { code: string; expiresAt: number };
// Survive Next.js hot-reload in dev by stashing on globalThis.
const g = globalThis as unknown as { __cipheraOtp?: Map<string, DemoRecord> };
const demoStore = g.__cipheraOtp ?? new Map<string, DemoRecord>();
g.__cipheraOtp = demoStore;

// E.164-ish sanity check: + followed by 8–15 digits.
export function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

// ---- LIVE: Twilio Verify REST calls (no SDK, just fetch) ----
function twilioAuthHeader(): string {
  const token = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
  ).toString("base64");
  return `Basic ${token}`;
}

async function twilioSend(phone: string): Promise<void> {
  const url = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: twilioAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: phone, Channel: "sms" }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Twilio send failed (${res.status}): ${detail}`);
  }
}

async function twilioCheck(phone: string, code: string): Promise<boolean> {
  const url = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: twilioAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: phone, Code: code }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { status?: string };
  return data.status === "approved";
}

// ---- Public API used by the route handlers ----

/** Returns a demo code string when running in DEMO mode, otherwise null. */
export async function sendOtp(phone: string): Promise<string | null> {
  if (isLiveOtp()) {
    await twilioSend(phone);
    return null;
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  demoStore.set(phone, { code, expiresAt: Date.now() + 5 * 60_000 });
  return code;
}

export async function checkOtp(phone: string, code: string): Promise<boolean> {
  if (isLiveOtp()) {
    return twilioCheck(phone, code);
  }
  const rec = demoStore.get(phone);
  if (!rec) return false;
  if (Date.now() > rec.expiresAt) {
    demoStore.delete(phone);
    return false;
  }
  const ok = rec.code === code.trim();
  if (ok) demoStore.delete(phone);
  return ok;
}
