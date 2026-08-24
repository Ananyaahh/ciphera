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

// Reject if a native call doesn't respond in time, so the UI can't hang
// forever on "Waiting on device".
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s.`)),
        ms
      )
    ),
  ]);
}

function nativeErrText(e: any): string {
  if (!e) return "unknown native error";
  return (
    e.message ||
    e.errorMessage ||
    (e.code != null ? `code ${e.code}` : "") ||
    (e.errorCode != null ? `errorCode ${e.errorCode}` : "") ||
    (() => {
      try {
        return JSON.stringify(e);
      } catch {
        return String(e);
      }
    })()
  );
}

// NOTE: never return a Capacitor plugin object out of an async function or
// resolve a promise with it -- JS runs a thenable-check that calls `.then()`
// on the proxy, which Capacitor forwards to native ("then() is not implemented
// on ios"). So we import the module and call methods on it directly, inline.

async function nativeAvailable(): Promise<boolean> {
  // If the check itself errors or hangs, don't block -- let the actual
  // verifyIdentity call run and produce a precise error instead.
  try {
    // @ts-ignore - resolved in the native/client build
    const mod: any = await import("@capgo/capacitor-native-biometric");
    const result: any = await withTimeout(
      mod.NativeBiometric.isAvailable(),
      8000,
      "Biometric availability check"
    );
    return result?.isAvailable !== false;
  } catch {
    return true;
  }
}

// Runs the native biometric prompt. Throws an Error with the REAL native
// reason on failure (so the UI can display it), instead of swallowing it.
async function nativePrompt(reason: string): Promise<void> {
  // @ts-ignore - resolved in the native/client build
  const mod: any = await import("@capgo/capacitor-native-biometric");
  try {
    await withTimeout(
      mod.NativeBiometric.verifyIdentity({
        reason,
        title: "CIPHERA",
        subtitle: "Confirm it's you",
        description: reason,
        useFallback: true, // allow device passcode if Face ID fails
      }),
      45000,
      "Face ID prompt"
    );
  } catch (e: any) {
    throw new Error("Biometric failed: " + nativeErrText(e));
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
    await nativePrompt(
      "Scan to enroll your cancellable biometric key on this device."
    );
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
    try {
      await nativePrompt("Confirm your identity to continue.");
      return { ok: true, seedMaterial: randomBytes(32) };
    } catch {
      return { ok: false, seedMaterial: null };
    }
  }
  return webVerify(credentialId);
}
