"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { getCurrentUser } from "@/lib/auth";
import QRCode from "qrcode";

// A user's public CIPHERA identity, as a QR code. This is safe to show and
// share -- it encodes the same username/identityToken that already appears
// on every photo's "Capture metadata" panel. It is NOT the private signing
// key: that key is generated non-extractable on-device (lib/crypto.ts) and
// never leaves the browser, let alone gets put in a QR code.
export default function MyId() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [identityToken, setIdentityToken] = useState<string | null>(null);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUsername(u.username);
    setIdentityToken(u.identityToken);
  }, [router]);

  useEffect(() => {
    if (!identityToken || !username || !canvasRef.current) return;
    const payload = JSON.stringify({
      app: "ciphera",
      username,
      identityToken,
    });
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 260,
      margin: 2,
      color: { dark: "#0a0a0c", light: "#f5efe6" },
    }).catch(() => {});
  }, [identityToken, username]);

  if (!username) {
    return (
      <>
        <Nav />
        <main className="px-6 py-16 text-center text-muted">Loading…</main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="px-6 py-10 bg-noise min-h-[calc(100vh-64px)]">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-display editorial text-3xl mb-2">Your Robust Watermark ID</h1>
          <p className="text-sm text-muted mb-8">
            This is your public identity -- safe to share. It's the same
            information already embedded in every photo you capture. Your
            private signing key never leaves this device and is not shown
            here.
          </p>

          <div className="glass rounded-2xl p-6 inline-block">
            <canvas ref={canvasRef} className="rounded-lg" />
          </div>

          <div className="mt-6 glass rounded-xl p-5 text-left font-mono text-xs space-y-2">
            <div>
              <span className="text-muted">username</span>
              <div className="break-all">{username}</div>
            </div>
            <div>
              <span className="text-muted">identity token</span>
              <div className="break-all">{identityToken}</div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}