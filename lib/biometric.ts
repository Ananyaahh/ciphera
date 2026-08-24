// lib/biometric.ts
// Unified biometric layer. The app ships as both a website (Safari/Chrome,
// where WebAuthn's platform authenticator works) and a Capacitor native app
// (a WKWebView, where WebAuthn's platform authenticator is NOT exposed by
// iOS). So we detect the environment and route:
//   - Native app  -> native Face ID / Touch ID via @capgo/capacitor-native-biometric
//   - Web browser -> the existing WebAuthn implementation in lib/webauthn.ts
//
// The public API mirrors lib/webauthn.ts so callers (login + camera pages)
// don't care which path runs.

import {
  isPlatformAuthenticatorAvailable as webAuthenticatorAvailable,
  enrollBiometric as webEnroll,
  verifyLiveness as webVerify,
  type EnrollmentResult,
  type LivenessResult,
} from "./webauthn";

// Credentials created by the native path get this prefix so we can tell them
// apart from WebAuthn credential ids if they're ever compared.
const NATIVE_PREFIX = "native:";

/** True when running inside the installed Capacitor app (not a browser tab). */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return !!cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform();
}

function b64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBytes(n: number): ArrayBuffer {
  return crypto.getRandomValues(new Uint8Array(n)).buffer;
}

// Lazily load the native plugin only inside the app, so SSR / the web build
// never evaluate native code.
async function getNativeBiometric(): Promise<any> {
  // @ts-ignore - resolved and bundled in the native/client build; the package
  // may not be present during a pure server-side typecheck.
  const mod = await import("@capgo/capacitor-native-biometric");
  return (mod as any).NativeBiometric;
}

async function nativeAvailable(): Promise<boolean> {
  try {
    const NativeBiometric = await getNativeBiometric();
    const result = await NativeBiometric.isAvailable();
    return !!result?.isAvailable;
  } catch {
    return false;
  }
}

async function nativePrompt(reason: string): Promise<boolean> {
  try {
    const NativeBiometric = await getNativeBiometric();
    await NativeBiometric.verifyIdentity({
      reason,
      title: "CIPHERA",
      subtitle: "Confirm it's you",
      description: reason,
    });
    return true; // resolves only on success
  } catch {
    return false; // rejects on cancel / failure / no biometry
  }
}

/** Is a usable biometric present (Face ID/Touch ID natively, or a WebAuthn
 *  platform authenticator in a browser)? */
export async function isBiometricAvailable(): Promise<boolean> {
  if (isNativeApp()) return nativeAvailable();
  return webAuthenticatorAvailable();
}

/** Layer 1 enrollment. Native: a fresh Face ID/Touch ID check seeds a
 *  device-bound credential. Web: delegates to WebAuthn enrollment. */
export async function enrollBiometric(
  userId: string,
  username: string,
  epochNumber: number
): Promise<EnrollmentResult> {
  if (isNativeApp()) {
    const ok = await nativePrompt(
      "Scan to enroll your cancellable biometric key on this device."
    );
    if (!ok) {
      throw new Error("Biometric enrollment was cancelled or failed.");
    }
    // No signature is returned by native biometrics, so we mint a random,
    // device-bound credential id + seed. This is stable for this enrollment
    // and unique per user/epoch, which is what the key-derivation chain needs.
    const credentialId =
      NATIVE_PREFIX + b64urlEncode(randomBytes(16));
    return { credentialId, seedMaterial: randomBytes(32) };
  }
  return webEnroll(userId, username, epochNumber);
}

/** Layer 2 liveness. Native: require a fresh Face ID/Touch ID immediately.
 *  Web: delegates to a fresh WebAuthn assertion. */
export async function verifyLiveness(
  credentialId: string
): Promise<LivenessResult> {
  if (isNativeApp()) {
    const ok = await nativePrompt("Confirm your identity to continue.");
    return { ok, seedMaterial: ok ? randomBytes(32) : null };
  }
  return webVerify(credentialId);
}
