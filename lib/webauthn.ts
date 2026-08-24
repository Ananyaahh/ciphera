// lib/webauthn.ts
// Browsers don't expose raw fingerprint sensors to web pages -- WebAuthn's
// platform authenticator (Touch ID / Windows Hello / Android fingerprint)
// is the closest thing the web platform has to "prove a live human touched
// this device's biometric sensor just now." We use it for both:
//   - Layer 1 enrollment: registering a platform credential (cancellable --
//     it can be revoked and re-registered per key-epoch without touching
//     the user's real fingerprint).
//   - Layer 2 capture-time authentication: requiring a fresh assertion
//     (userVerification: "required") immediately before the shutter fires.

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.PublicKeyCredential &&
    !!navigator.credentials
  );
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function b64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): ArrayBuffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    str.length + ((4 - (str.length % 4)) % 4),
    "="
  );
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export interface EnrollmentResult {
  credentialId: string; // base64url
  seedMaterial: ArrayBuffer; // fed into the cancellable-transform + HKDF chain
}

/** Layer 1: enroll a biometric-backed platform credential for this user on
 *  this device. Returns a credential id (stored server-side / in the user
 *  record) and seed material derived from the fresh attestation, which
 *  feeds the fuzzy-extractor / HKDF chain in lib/auth.ts. */
export async function enrollBiometric(
  userId: string,
  username: string,
  epochNumber: number
): Promise<EnrollmentResult> {
  if (!isWebAuthnSupported()) {
    throw new Error(
      "This browser/device doesn't expose a platform authenticator (fingerprint / face unlock)."
    );
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(`${userId}:${epochNumber}`);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "CIPHERA" },
      user: {
        id: userIdBytes,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256 fallback
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential;

  const response = credential.response as AuthenticatorAttestationResponse;
  const seedMaterial = response.getPublicKey
    ? response.getPublicKey() ?? response.attestationObject
    : response.attestationObject;

  return {
    credentialId: b64urlEncode(credential.rawId),
    seedMaterial: seedMaterial as ArrayBuffer,
  };
}

export interface LivenessResult {
  ok: boolean;
  seedMaterial: ArrayBuffer | null; // fresh assertion signature -> per-capture entropy
}

/** Layer 2: fresh biometric + liveness/PAD check, gating the shutter (or
 *  the opening of a session-liveness window, §3.1). WebAuthn's own
 *  userVerification="required" + platform PAD stands in for the paper's
 *  liveness/presentation-attack detector. */
export async function verifyLiveness(
  credentialId: string
): Promise<LivenessResult> {
  if (!isWebAuthnSupported()) {
    return { ok: false, seedMaterial: null };
  }
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          { id: b64urlDecode(credentialId), type: "public-key" },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    })) as PublicKeyCredential;

    const response = assertion.response as AuthenticatorAssertionResponse;
    return { ok: true, seedMaterial: response.signature };
  } catch (err) {
    return { ok: false, seedMaterial: null };
  }
}
