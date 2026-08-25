"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import { getCurrentUser } from "@/lib/auth";
import { getImage, deleteImage } from "@/lib/db";
import { blobToImageData, blobToObjectUrl } from "@/lib/image";
import { verifyImageData } from "@/lib/verify";
import VerificationCard from "@/components/VerificationCard";
import type { CipheraImage, VerificationResult } from "@/lib/types";

export default function Detail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [image, setImage] = useState<CipheraImage | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [tampered, setTampered] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    getImage(params.id).then((img) => {
      if (!img) return;
      setImage(img);
      setObjectUrl(blobToObjectUrl(img.blob));
    });
  }, [params.id, router]);

  async function runVerification() {
    if (!image) return;
    setBusy(true);
    try {
      let imageData: ImageData;
      if (tampered && canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d")!;
        imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      } else {
        imageData = await blobToImageData(image.blob);
      }
      const r = await verifyImageData(imageData);
      setResult(r);
    } finally {
      setBusy(false);
    }
  }

  async function simulateTamper() {
    if (!image || !canvasRef.current) return;
    const imageData = await blobToImageData(image.blob);
    const canvas = canvasRef.current;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(imageData, 0, 0);
    // A crude pixel-level edit: a scribble, exactly the kind of tamper the
    // fragile layer is designed to catch.
    ctx.strokeStyle = "red";
    ctx.lineWidth = Math.max(6, imageData.width * 0.02);
    ctx.beginPath();
    ctx.moveTo(imageData.width * 0.2, imageData.height * 0.3);
    ctx.lineTo(imageData.width * 0.8, imageData.height * 0.7);
    ctx.stroke();
    setTampered(true);
    setResult(null);
  }

  function resetTamper() {
    setTampered(false);
    setResult(null);
  }

  async function handleDelete() {
    if (!image) return;
    if (!confirm("Remove this image from your local gallery?")) return;
    await deleteImage(image.id);
    router.push("/gallery");
  }

  if (!image) {
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
        <div className="mx-auto max-w-4xl">
          <Link href="/gallery" className="text-xs font-mono text-thread-teal hover:underline">
            ← Back to gallery
          </Link>
          <h1 className="font-display editorial text-4xl mt-3 mb-6">
            Capture #{image.ledgerIndex}
          </h1>

          <div className="grid md:grid-cols-[1.2fr_1fr] gap-8">
            <div className="rounded-2xl overflow-hidden border border-ink-700 bg-ink-950 shadow-[0_28px_90px_-28px_rgba(0,0,0,0.65)]">
              {tampered ? (
                <canvas ref={canvasRef} className="w-full h-auto block" />
              ) : (
                <>
                  {objectUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={objectUrl} alt="" className="w-full h-auto block" />
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </>
              )}
            </div>

            <div className="space-y-6">
              <div className="glass rounded-xl p-5">
                <h2 className="font-display text-lg mb-3">Capture metadata</h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 font-mono text-xs">
                  <dt className="text-muted">identity</dt>
                  <dd className="break-all">{image.payload.identityToken}</dd>
                  <dt className="text-muted">captured</dt>
                  <dd>{new Date(image.payload.capturedAt).toLocaleString()}</dd>
                  <dt className="text-muted">epoch</dt>
                  <dd>{image.payload.epochNumber}</dd>
                  <dt className="text-muted">nonce</dt>
                  <dd className="break-all">{image.payload.nonce}</dd>
                  <dt className="text-muted">image hash</dt>
                  <dd className="break-all">{image.payload.imageHash.slice(0, 24)}…</dd>
                  <dt className="text-muted">ledger #</dt>
                  <dd>{image.ledgerIndex}</dd>
                </dl>
              </div>

              <div className="glass rounded-xl p-5 space-y-3">
                <h2 className="font-display text-lg">Check this image</h2>
                <button
                  onClick={runVerification}
                  disabled={busy}
                  className="btn-primary w-full"
                >
                  {busy ? "Verifying…" : "Run verification"}
                </button>
                <div className="flex gap-2">
                  {!tampered ? (
                    <button onClick={simulateTamper} className="btn-secondary flex-1 text-xs">
                      Simulate a tamper
                    </button>
                  ) : (
                    <button onClick={resetTamper} className="btn-secondary flex-1 text-xs">
                      Reset to original
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  "Simulate a tamper" edits pixels in your browser only, for
                  demonstration — it doesn't touch the stored original.
                </p>
              </div>

              {result && <VerificationCard result={result} />}

              <button
                onClick={handleDelete}
                className="text-xs text-signal-tamper hover:underline"
              >
                Delete this image
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
