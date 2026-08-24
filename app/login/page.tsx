"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import SecurityThread from "@/components/SecurityThread";
import LightRays from "@/components/reactbits/LightRays";
import {
  createAccount,
  getUserByUsername,
  getUserById,
  verifyPassword,
  attachCredential,
  attachPublicKey,
  attachPhone,
  upsertGoogleUser,
  setSession,
} from "@/lib/auth";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: any;
  }
}
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  enrollBiometric,
  verifyLiveness,
} from "@/lib/webauthn";
import { generateDeviceKeyPair, exportPublicKeyJwk } from "@/lib/crypto";
import { putDeviceKeyPair, getDeviceKeyPair } from "@/lib/db";
import type { CipheraUser } from "@/lib/types";

type Mode = "signup" | "signin";
type Step = "credentials" | "otp" | "biometric" | "done";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [step, setStep] = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<CipheraUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioStatus, setBioStatus] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  function resetFlow() {
    setStep("credentials");
    setError(null);
    setOtpInput("");
    setDemoOtp(null);
    setPendingUser(null);
    setBioStatus(null);
  }

  // Ask the server to send an OTP to `phoneNumber`. Returns a demo code when
  // no SMS provider is configured server-side, otherwise null (real SMS sent).
  async function requestOtp(phoneNumber: string): Promise<string | null> {
    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phoneNumber }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Could not send the code.");
    return data?.demoCode ?? null;
  }

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      let user: CipheraUser;
      let otpPhone: string;
      if (mode === "signup") {
        if (username.trim().length < 3) throw new Error("Username needs at least 3 characters.");
        if (password.length < 8) throw new Error("Password needs at least 8 characters.");
        if (!/^\+[1-9]\d{7,14}$/.test(phone.trim()))
          throw new Error("Enter your phone in international format, e.g. +14155552671.");
        user = await createAccount(username.trim(), password);
        attachPhone(user.id, phone.trim());
        otpPhone = phone.trim();
        setPendingUser(getUserById(user.id) ?? user);
      } else {
        const found = getUserByUsername(username.trim());
        if (!found) throw new Error("No account with that username on this device.");
        const ok = await verifyPassword(found, password);
        if (!ok) throw new Error("Incorrect password.");
        if (!found.phone)
          throw new Error("This account has no phone on file. Re-enroll to add one.");
        user = found;
        otpPhone = found.phone;
        setPendingUser(found);
      }
      const demoCode = await requestOtp(otpPhone);
      setDemoOtp(demoCode); // null in live mode; a string only in demo mode
      setStep("otp");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const otpPhone = pendingUser?.phone ?? phone.trim();
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: otpPhone, code: otpInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Verification failed.");
      if (!data?.ok) {
        setError("That code doesn't match (or has expired).");
        return;
      }
      setStep("biometric");
    } catch (err: any) {
      setError(err?.message ?? "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  // ---- Continue with Google ----
  async function handleGoogleCredential(response: { credential?: string }) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response?.credential }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok)
        throw new Error(data?.error ?? "Google sign-in failed.");

      const user = await upsertGoogleUser({
        googleSub: data.googleSub,
        email: data.email,
        name: data.name,
      });
      // Google proved the account; now bind/confirm the device biometric,
      // reusing the existing flow (enrolls if this device isn't bound yet).
      setPendingUser(user);
      setMode("signin");
      setStep("biometric");
    } catch (err: any) {
      setError(err?.message ?? "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    if (step !== "credentials") return;

    let cancelled = false;
    function render() {
      if (cancelled || !window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      googleBtnRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 320,
      });
    }

    if (window.google) {
      render();
    } else {
      const existing = document.getElementById("gsi-script");
      if (existing) {
        existing.addEventListener("load", render, { once: true });
      } else {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.id = "gsi-script";
        s.async = true;
        s.defer = true;
        s.onload = render;
        document.head.appendChild(s);
      }
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode]);

  async function handleBiometric() {
    if (!pendingUser) return;
    setError(null);
    setBusy(true);
    setBioStatus("Waiting for your device's biometric prompt…");
    try {
      if (!isWebAuthnSupported()) {
        throw new Error(
          "This browser doesn't support platform biometrics. Try a modern Chrome, Safari, or Edge on a device with Touch ID / Windows Hello / a fingerprint sensor."
        );
      }
      const available = await isPlatformAuthenticatorAvailable();
      if (!available) {
        throw new Error(
          "No platform authenticator (fingerprint / face unlock) was found on this device."
        );
      }

      if (mode === "signup") {
        const { credentialId } = await enrollBiometric(
          pendingUser.id,
          pendingUser.username,
          pendingUser.currentEpoch
        );
        attachCredential(pendingUser.id, credentialId);
        const keyPair = await generateDeviceKeyPair();
        await putDeviceKeyPair(pendingUser.id, keyPair);
        attachPublicKey(pendingUser.id, await exportPublicKeyJwk(keyPair.publicKey));
        setBioStatus("Biometric enrolled and bound to this device.");
      } else {
        const existingKeyPair = await getDeviceKeyPair(pendingUser.id);
        if (!pendingUser.webauthnCredentialId || !existingKeyPair) {
          // New device for an existing account: enroll it now.
          const { credentialId } = await enrollBiometric(
            pendingUser.id,
            pendingUser.username,
            pendingUser.currentEpoch
          );
          attachCredential(pendingUser.id, credentialId);
          const keyPair = await generateDeviceKeyPair();
          await putDeviceKeyPair(pendingUser.id, keyPair);
          attachPublicKey(pendingUser.id, await exportPublicKeyJwk(keyPair.publicKey));
          setBioStatus("This device wasn't enrolled yet — enrolled it now.");
        } else {
          const result = await verifyLiveness(pendingUser.webauthnCredentialId);
          if (!result.ok) throw new Error("Liveness check failed or was cancelled.");
          setBioStatus("Live biometric confirmed.");
        }
      }
      setSession(pendingUser.id);
      setStep("done");
      setTimeout(() => router.push("/camera"), 900);
    } catch (err: any) {
      setError(err.message ?? "Biometric step failed.");
      setBioStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="relative min-h-[calc(100vh-64px)] px-6 py-14 bg-noise overflow-hidden">
        <div className="absolute inset-0 z-0">
          <LightRays
            raysOrigin="top-center"
            raysColor="#E2B874"
            raysSpeed={1.1}
            lightSpread={0.7}
            rayLength={1.4}
            followMouse
            mouseInfluence={0.08}
            noiseAmount={0.06}
            distortion={0.03}
            className="w-full h-full"
          />
        </div>
        <div className="relative z-10 mx-auto max-w-md">
          <p className="eyebrow text-thread-teal mb-3">
            Layer 1 · Enrollment
          </p>
          <h1 className="font-display editorial text-4xl mb-3">
            {mode === "signup" ? "Enroll your identity" : "Sign in"}
          </h1>
          <p className="text-muted text-sm mb-8 leading-relaxed">
            {mode === "signup"
              ? "Three steps: credentials, OTP, then a biometric scan that seeds your cancellable-biometric key."
              : "Confirm your credentials, then re-confirm with a live biometric scan."}
          </p>

          <StepIndicator step={step} />

          <div className="mt-8 glass rounded-2xl p-6 sm:p-7">
            {step === "credentials" && (
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <Field label="Username">
                  <input
                    className="input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </Field>
                <Field label="Password">
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                  />
                </Field>
                {mode === "signup" && (
                  <Field label="Phone (for SMS code)">
                    <input
                      className="input"
                      type="tel"
                      inputMode="tel"
                      placeholder="+14155552671"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                      required
                    />
                  </Field>
                )}
                {error && <ErrorNote text={error} />}
                <button className="btn-primary w-full" disabled={busy}>
                  {busy ? "Working…" : mode === "signup" ? "Create account" : "Continue"}
                </button>
                <p className="text-center text-xs text-muted">
                  {mode === "signup" ? "Already enrolled?" : "New here?"}{" "}
                  <button
                    type="button"
                    className="text-thread-teal hover:underline"
                    onClick={() => {
                      setMode(mode === "signup" ? "signin" : "signup");
                      resetFlow();
                    }}
                  >
                    {mode === "signup" ? "Sign in instead" : "Enroll instead"}
                  </button>
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <div className="h-px flex-1 bg-ink-700" />
                  <span className="text-[0.65rem] font-mono uppercase tracking-wider text-muted">
                    or
                  </span>
                  <div className="h-px flex-1 bg-ink-700" />
                </div>
                {GOOGLE_CLIENT_ID ? (
                  <div className="flex justify-center pt-1">
                    <div ref={googleBtnRef} />
                  </div>
                ) : (
                  <p className="text-center text-[0.7rem] text-muted">
                    Google sign-in appears here once{" "}
                    <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>{" "}
                    is set.
                  </p>
                )}
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <p className="text-sm text-muted">
                  Enter the 6-digit code we sent to verify it's really you.
                </p>
                {demoOtp && (
                  <div className="rounded-lg border border-thread-teal/30 bg-thread-teal/10 px-4 py-3 text-sm font-mono text-thread-teal">
                    Demo mode — no SMS provider connected. Your code:{" "}
                    <strong>{demoOtp}</strong>
                  </div>
                )}
                <Field label="One-time code">
                  <input
                    className="input tracking-[0.3em] text-center font-mono"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    maxLength={6}
                    required
                  />
                </Field>
                {error && <ErrorNote text={error} />}
                <button className="btn-primary w-full">Verify code</button>
              </form>
            )}

            {step === "biometric" && (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  {mode === "signup"
                    ? "One more step: scan your fingerprint to seed your cancellable biometric key and bind it to this device."
                    : "Confirm you're physically present with a fresh biometric scan."}
                </p>
                <div className="flex items-center justify-center py-6">
                  <FingerprintGlyph active={busy} />
                </div>
                {bioStatus && (
                  <p className="text-center text-sm text-thread-teal">{bioStatus}</p>
                )}
                {error && <ErrorNote text={error} />}
                <button
                  className="btn-primary w-full"
                  onClick={handleBiometric}
                  disabled={busy}
                >
                  {busy ? "Waiting on device…" : "Scan fingerprint"}
                </button>
              </div>
            )}

            {step === "done" && (
              <div className="text-center py-6 space-y-3">
                <p className="text-thread-teal font-display text-xl">
                  You're enrolled.
                </p>
                <p className="text-muted text-sm">Redirecting to the camera…</p>
              </div>
            )}
          </div>

          <div className="mt-10">
            <SecurityThread label="ENROLL" />
          </div>
        </div>
      </main>
    </>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "credentials", label: "Credentials" },
    { key: "otp", label: "OTP" },
    { key: "biometric", label: "Biometric" },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2 flex-1">
          <div
            className={`h-1 rounded-full flex-1 transition-colors ${
              i <= activeIndex || step === "done" ? "bg-thread-gradient" : "bg-ink-700"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-wider text-muted mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-signal-tamper/30 bg-signal-tamper/10 px-4 py-2.5 text-sm text-signal-tamper">
      {text}
    </div>
  );
}

function FingerprintGlyph({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`w-20 h-20 ${active ? "animate-pulseThin" : ""}`}
    >
      {[10, 18, 26, 34, 42].map((r, i) => (
        <path
          key={r}
          d={`M 50 50 m -${r},0 a ${r},${r} 0 1 0 ${r * 2},0`}
          fill="none"
          stroke={i % 2 === 0 ? "rgb(var(--color-thread-teal))" : "rgb(var(--color-thread-indigo))"}
          strokeWidth="1.5"
          strokeDasharray={`${r * 4} ${r}`}
          opacity={0.85 - i * 0.12}
        />
      ))}
    </svg>
  );
}
