"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import {
  getCurrentUser,
  getActiveEpoch,
  getCaptureWindow,
  openCaptureWindow,
  consumeCaptureFrame,
  closeCaptureWindow,
  SESSION_WINDOW_MS,
  SESSION_WINDOW_MAX_FRAMES,
} from "@/lib/auth";
import { verifyLiveness } from "@/lib/webauthn";
import { hkdf, randomHex, randomId, sha256Hex, signHex, bufToHex } from "@/lib/crypto";
import { getDeviceKeyPair, putImage, getImagesForUser } from "@/lib/db";
import { appendRecord } from "@/lib/ledger";
import { embedWatermark } from "@/lib/watermark";
import type { CipheraUser, CaptureSessionWindow, CipheraImage } from "@/lib/types";
import Link from "next/link";

export default function CameraPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [user, setUser] = useState<CipheraUser | null>(null);
  const [win, setWin] = useState<CaptureSessionWindow | null>(null);
  const [now, setNow] = useState(Date.now());
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [recent, setRecent] = useState<CipheraImage[]>([]);
  const [flash, setFlash] = useState(false);

  // auth + camera bootstrap
  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    setWin(getCaptureWindow(u.id));

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraError("Camera access was denied or is unavailable."));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    getImagesForUser(user.id).then((imgs) =>
      setRecent(
        (imgs as CipheraImage[])
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 6)
      )
    );
  }, [user, statusMsg]);

  // ticking clock for the countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const refreshWindow = useCallback(() => {
    if (!user) return;
    setWin(getCaptureWindow(user.id));
  }, [user]);

  async function openFreshWindow(): Promise<CaptureSessionWindow> {
    if (!user) throw new Error("Not signed in.");
    if (!user.webauthnCredentialId) {
      throw new Error("No biometric credential enrolled. Sign in again to enroll one.");
    }
    setStatusMsg("Requesting a fresh biometric scan…");
    const result = await verifyLiveness(user.webauthnCredentialId);
    if (!result.ok) {
      throw new Error("Liveness check failed, was cancelled, or timed out.");
    }
    const epoch = getActiveEpoch(user.id);
    if (!epoch) throw new Error("No active key-epoch for this account.");
    const w = openCaptureWindow(user.id, epoch.epochNumber);
    setWin(w);
    setStatusMsg("Liveness confirmed. Capture window open.");
    return w;
  }

  async function handleShutter() {
    if (!user || !videoRef.current || !canvasRef.current) return;
    setError(null);
    setBusy(true);
    try {
      let activeWindow = getCaptureWindow(user.id);
      if (!activeWindow) {
        activeWindow = await openFreshWindow();
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const w = video.videoWidth || 960;
      const h = video.videoHeight || 720;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(video, 0, 0, w, h);
      const rawImageData = ctx.getImageData(0, 0, w, h);

      const imageHash = await sha256Hex(rawImageData.data as unknown as Uint8Array);
      const nonce = randomHex(16);
      const imageId = randomId();
      const capturedAt = Date.now();

      const keyPair = await getDeviceKeyPair(user.id);
      if (!keyPair) {
        throw new Error(
          "No device signing key found. This device may need to be re-enrolled from the sign-in page."
        );
      }

      // Layer 3: per-image key derivation (HKDF) -- combines a fresh
      // liveness-assertion-flavored seed, the image hash, timestamp, and a
      // random nonce into a key unique to this exact photo. Shown here as
      // transparency into the pipeline, not as the watermark payload
      // itself (that stays the signed, human-checkable metadata below).
      const ikm = new TextEncoder().encode(`${user.id}:${imageHash}`);
      const derivedKey = await hkdf(
        ikm,
        nonce,
        `ciphera:capture:${imageId}:${capturedAt}`,
        256
      );
      const derivedKeyHex = bufToHex(derivedKey);

      const payload = {
        identityToken: user.identityToken,
        userId: user.id,
        epochNumber: activeWindow.epochNumber,
        imageId,
        capturedAt,
        nonce,
        imageHash,
      };

      const payloadHash = await sha256Hex(JSON.stringify(payload));
      const signature = await signHex(keyPair.privateKey, payloadHash);
      const ledgerRecord = await appendRecord("capture", payloadHash, signature);

      const embedded = await embedWatermark(rawImageData, payload);
      ctx.putImageData(embedded.imageData, 0, 0);

      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), "image/png")
      );

      const thumbCanvas = document.createElement("canvas");
      const scale = 220 / w;
      thumbCanvas.width = 220;
      thumbCanvas.height = Math.round(h * scale);
      const tctx = thumbCanvas.getContext("2d")!;
      tctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      const thumbnail = thumbCanvas.toDataURL("image/jpeg", 0.8);

      const record: CipheraImage = {
        id: imageId,
        userId: user.id,
        createdAt: capturedAt,
        width: w,
        height: h,
        blob,
        thumbnail,
        payload,
        ledgerIndex: ledgerRecord.index,
        fragileHash: embedded.fragileHash,
      };
      await putImage(record);

      const updatedWindow = consumeCaptureFrame(user.id);
      setWin(updatedWindow);
      setFlash(true);
      setTimeout(() => setFlash(false), 220);
      setStatusMsg(
        `Captured & sealed · per-image key ${derivedKeyHex.slice(0, 10)}… · ledger #${ledgerRecord.index}`
      );
    } catch (err: any) {
      setError(err.message ?? "Capture failed.");
    } finally {
      setBusy(false);
    }
  }

  const windowSecondsLeft = win ? Math.max(0, Math.round((win.expiresAt - now) / 1000)) : 0;
  const windowActive = !!win && windowSecondsLeft > 0 && win.framesUsed < win.maxFrames;

  return (
    <>
      <Nav />
      <main className="px-6 py-10 bg-noise min-h-[calc(100vh-64px)]">
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow text-thread-teal mb-2">
            Layer 2–3 · Capture-time authentication &amp; embedding
          </p>
          <h1 className="font-display editorial text-4xl mb-6">Camera</h1>

          <div className="relative rounded-2xl overflow-hidden border border-ink-700 bg-ink-950 aspect-[4/3] shadow-[0_28px_90px_-28px_rgba(0,0,0,0.65)]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {flash && <div className="absolute inset-0 bg-white/80 animate-none" />}
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink-950/90 px-8 text-center text-sm text-muted">
                {cameraError}
              </div>
            )}

            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  windowActive ? "bg-signal-verified animate-pulseThin" : "bg-signal-warn"
                }`}
              />
              <span className="font-mono text-[11px] uppercase tracking-wider bg-ink-950/70 rounded-full px-2.5 py-1">
                {windowActive
                  ? `Live window · ${windowSecondsLeft}s · ${win!.framesUsed}/${win!.maxFrames} frames`
                  : "Fresh scan required"}
              </span>
            </div>

            {windowActive && (
              <button
                onClick={() => {
                  closeCaptureWindow();
                  refreshWindow();
                }}
                className="absolute top-3 right-3 font-mono text-[11px] uppercase tracking-wider bg-ink-950/70 rounded-full px-2.5 py-1 hover:text-thread-teal"
              >
                Lock now
              </button>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              onClick={handleShutter}
              disabled={busy || !!cameraError}
              className="w-20 h-20 rounded-full border-4 border-ink-600 hover:border-thread-teal transition-colors disabled:opacity-40 flex items-center justify-center"
              aria-label="Capture photo"
            >
              <span className="w-14 h-14 rounded-full bg-thread-gradient bg-[length:200%_100%]" />
            </button>
            <p className="text-xs text-muted font-mono">
              {busy ? "Sealing frame…" : "Press to capture"}
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-signal-tamper/30 bg-signal-tamper/10 px-4 py-2.5 text-sm text-signal-tamper">
              {error}
            </div>
          )}
          {statusMsg && !error && (
            <p className="mt-4 text-center text-xs font-mono text-thread-teal break-words">
              {statusMsg}
            </p>
          )}

          {recent.length > 0 && (
            <div className="mt-12">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg">Just captured</h2>
                <Link href="/gallery" className="text-xs font-mono text-thread-teal hover:underline">
                  Open full gallery →
                </Link>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {recent.map((img) => (
                  <Link
                    key={img.id}
                    href={`/gallery/${img.id}`}
                    className="block rounded-lg overflow-hidden border border-ink-700 hover:border-thread-teal transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.thumbnail} alt="" className="w-full aspect-square object-cover" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
