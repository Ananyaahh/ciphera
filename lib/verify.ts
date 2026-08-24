// lib/verify.ts
// Architecture §Layer 5: extract both watermark layers from any submitted
// image, cross-check the recovered payload against the ledger, and verify
// the device-bound signature -- then return who / when / tampered.

import { sha256Hex, importPublicKeyJwk, verifyHex } from "./crypto";
import { extractWatermark } from "./watermark";
import { getLedger, verifyChainIntegrity } from "./ledger";
import { getUserById, getEpoch } from "./auth";
import type { VerificationResult } from "./types";

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
      details:
        "No CIPHERA watermark could be recovered from this image. Either it wasn't captured through CIPHERA, or it has been altered heavily enough to destroy the robust layer.",
    };
  }

  const payload = extract.payload;
  const payloadHash = await sha256Hex(JSON.stringify(payload));
  const ledger = getLedger();
  const record = ledger.find(
    (r) => r.type === "capture" && r.payloadHash === payloadHash
  );

  const user = getUserById(payload.userId);
  const epoch = getEpoch(payload.userId, payload.epochNumber);

  if (!record || !user) {
    return {
      status: "unverifiable",
      identityToken: payload.identityToken,
      username: user?.username ?? null,
      capturedAt: payload.capturedAt,
      epochNumber: payload.epochNumber,
      epochStatus: epoch?.status ?? null,
      ledgerMatch: false,
      fragileIntact: extract.fragileIntact,
      details:
        "A watermark payload was found, but no matching anchor exists in the provenance ledger. This image cannot be confirmed as authentic.",
    };
  }

  let signatureOk = false;
  if (user.publicKeyJwk) {
    try {
      const pubKey = await importPublicKeyJwk(user.publicKeyJwk);
      signatureOk = await verifyHex(pubKey, record.payloadHash, record.signature);
    } catch {
      signatureOk = false;
    }
  }

  const chain = await verifyChainIntegrity();

  if (!extract.fragileIntact) {
    return {
      status: "tampered",
      identityToken: payload.identityToken,
      username: user.username,
      capturedAt: payload.capturedAt,
      epochNumber: payload.epochNumber,
      epochStatus: epoch?.status ?? null,
      ledgerMatch: true,
      fragileIntact: false,
      details:
        "The capturer and ledger anchor check out, but the fragile tamper-evidence layer has broken -- this image has been edited at the pixel level since it was captured.",
    };
  }

  if (!signatureOk || !chain.ok) {
    return {
      status: "unverifiable",
      identityToken: payload.identityToken,
      username: user.username,
      capturedAt: payload.capturedAt,
      epochNumber: payload.epochNumber,
      epochStatus: epoch?.status ?? null,
      ledgerMatch: true,
      fragileIntact: true,
      details: !chain.ok
        ? "The provenance ledger on this device has been tampered with -- its hash chain no longer verifies."
        : "The ledger anchor exists but its signature does not verify against the claimed capturer's device key.",
    };
  }

  return {
    status: "verified",
    identityToken: payload.identityToken,
    username: user.username,
    capturedAt: payload.capturedAt,
    epochNumber: payload.epochNumber,
    epochStatus: epoch?.status ?? null,
    ledgerMatch: true,
    fragileIntact: true,
    details:
      "Capturer identity, ledger anchor, and pixel integrity all check out. This image is untampered since capture.",
  };
}
