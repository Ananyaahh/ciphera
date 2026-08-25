// lib/cors.ts
// The Capacitor app is served from a different origin (localhost) than the
// API on Vercel, so these routes must send CORS headers and answer the
// browser's preflight OPTIONS request. These endpoints don't expose secrets,
// so allowing any origin is fine here.
import { NextResponse } from "next/server";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function corsJson(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: CORS_HEADERS,
  });
}

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
