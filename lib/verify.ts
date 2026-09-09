// lib/verify.ts
// Architecture §Layer 5: extract the watermark locally (needs raw pixel
// access, so this part stays client-side), then ask the SHARED backend
// whether it matches a real capture -- this is what makes verification
// work across different people's devices, not just your own browser.

import { extractWatermark } from "./watermark";
import type { VerificationResult } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export async function verifyImageData(
  imageData: ImageData
): Promise<VerificationResult> {
  const extract = await extractWatermark(imageData);

  if (!extract.payload) {
    return {
      status: "unverifiable",
      identityToken: null,
      username: null,
      capturedAt: null,
      epochNumber: null,
      epochStatus: null,
      ledgerMatch: false,
      fragileIntact: extract.fragileIntact,
      geo: null,
      details:
        "No CIPHERA watermark could be recovered from this image. Either it wasn't captured through CIPHERA, or it has been altered heavily enough to destroy the robust layer.",
    };
  }

  try {
    const res = await fetch(`${API_BASE}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: extract.payload,
        fragileIntact: extract.fragileIntact,
      }),
    });

    if (!res.ok) {
      throw new Error("Verification service returned an error.");
    }

    return (await res.json()) as VerificationResult;
  } catch {
    return {
      status: "unverifiable",
      identityToken: extract.payload.identityToken,
      username: null,
      capturedAt: extract.payload.capturedAt,
      epochNumber: extract.payload.epochNumber,
      epochStatus: null,
      ledgerMatch: false,
      fragileIntact: extract.fragileIntact,
      geo: null,
      details: "Could not reach the CIPHERA verification service.",
    };
  }
}