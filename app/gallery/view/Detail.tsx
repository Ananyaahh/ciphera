"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import { getCurrentUser } from "@/lib/auth";
import { getImage, deleteImage } from "@/lib/db";
import { blobToImageData, blobToObjectUrl } from "@/lib/image";
import { verifyImageData } from "@/lib/verify";
import VerificationCard from "@/components/VerificationCard";
import type { CipheraImage, VerificationResult } from "@/lib/types";

export default function Detail() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [image, setImage] = useState<CipheraImage | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [tampered, setTampered] = useState(false);
  const [captioning, setCaptioning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setId(params.get("id") ?? "");
    }
  }, []);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUsername(u.username);
    if (!id) return;
    getImage(id).then((img) => {
      if (!img) return;
      setImage(img);
      setObjectUrl(blobToObjectUrl(img.blob));
    });
  }, [id, router]);

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

  // Turns lat/lng into a human-readable address using OpenStreetMap's free
  // Nominatim reverse-geocoding service. No API key needed. If the network
  // call fails (offline, rate-limited, etc.) we fall back gracefully.
  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) throw new Error("geocode failed");
      const data = await res.json();
      const a = data.address ?? {};
      const locality =
        a.suburb || a.neighbourhood || a.city_district || a.town || a.village || a.city || "";
      const city = a.city || a.town || a.village || a.county || "";
      const region = a.state || a.country || "";
      const title = [locality, city].filter(Boolean).join(", ") || city || "Unknown location";
      const subtitle: string = data.display_name || [city, region].filter(Boolean).join(", ");
      return { title, subtitle };
    } catch {
      return { title: null, subtitle: null };
    }
  }

  function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = text.slice(0, mid) + "…";
      if (ctx.measureText(candidate).width <= maxWidth) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return text.slice(0, lo) + "…";
  }

  // Draws a stylized, satellite-map-like thumbnail (not a live tile fetch),
  // so the caption always renders instantly and never depends on a
  // third-party map server being reachable during a live demo. Deliberately
  // detailed (irregular field/parcel shapes, a road, an accuracy halo)
  // rather than a flat placeholder, so it reads as "a map" at a glance.
  function drawMapThumbnail(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 10);
    ctx.clip();

    // Base terrain gradient
    const grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, "#38493d");
    grad.addColorStop(1, "#2a362d");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, size, size);

    // Irregular "parcel" shapes to read as farmland/urban blocks from above
    const parcels: Array<[number, number][]> = [
      [[0, 0], [0.42, 0], [0.35, 0.28], [0, 0.22]],
      [[0.42, 0], [1, 0], [1, 0.18], [0.55, 0.3]],
      [[0, 0.55], [0.3, 0.48], [0.4, 0.85], [0.05, 1], [0, 1]],
      [[0.45, 0.4], [0.8, 0.35], [1, 0.6], [0.85, 1], [0.5, 0.95]],
      [[0.3, 0.28], [0.55, 0.3], [0.45, 0.4], [0.3, 0.48]],
    ];
    const shades = ["#41523f", "#4a5c46", "#374536", "#4d5f4a", "#3a4a3d"];
    parcels.forEach((poly, i) => {
      ctx.fillStyle = shades[i % shades.length];
      ctx.beginPath();
      poly.forEach(([px, py], j) => {
        const ax = x + px * size;
        const ay = y + py * size;
        if (j === 0) ctx.moveTo(ax, ay);
        else ctx.lineTo(ax, ay);
      });
      ctx.closePath();
      ctx.fill();
    });

    // A road cutting across
    ctx.strokeStyle = "#8c8067";
    ctx.lineWidth = Math.max(2, size * 0.035);
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.72);
    ctx.bezierCurveTo(
      x + size * 0.3, y + size * 0.6,
      x + size * 0.6, y + size * 0.68,
      x + size, y + size * 0.48
    );
    ctx.stroke();

    // Subtle vignette for depth
    const vg = ctx.createRadialGradient(
      x + size / 2, y + size / 2, size * 0.2,
      x + size / 2, y + size / 2, size * 0.75
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(x, y, size, size);

    ctx.restore();

    // Location accuracy halo + pin
    const cx = x + size / 2;
    const cy = y + size / 2 - size * 0.04;

    ctx.fillStyle = "rgba(94, 170, 255, 0.18)";
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(94, 170, 255, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const pinR = size * 0.1;
    ctx.fillStyle = "#e2543a";
    ctx.beginPath();
    ctx.arc(cx, cy, pinR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - pinR * 0.7, cy + pinR * 0.55);
    ctx.lineTo(cx + pinR * 0.7, cy + pinR * 0.55);
    ctx.lineTo(cx, cy + pinR * 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#20291f";
    ctx.beginPath();
    ctx.arc(cx, cy, pinR * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Frame
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, size - 1, size - 1, 10);
    ctx.stroke();
  }

  // Builds a SEPARATE, human-readable copy with a GPS-camera-style caption
  // card burned into the pixels: location name/address, lat/long, and
  // capture time. This is for showing to people who just want to look at
  // the photo -- it is NOT the file that stays CIPHERA-verifiable, since
  // burning pixels changes the fragile tamper-evidence layer on purpose.
  // The plain "Download image" button above stays the verifiable original.
  async function downloadWithGeotag() {
    if (!image || !objectUrl) return;
    setCaptioning(true);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not load image."));
        img.src = objectUrl;
      });

      const geo = image.payload.geo;
      const geocode = geo ? await reverseGeocode(geo.lat, geo.lng) : { title: null, subtitle: null };

      const barHeight = Math.max(165, Math.round(img.height * 0.17));
      const padding = Math.round(barHeight * 0.13);
      const mapSize = barHeight - padding * 2;

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height + barHeight;
      const ctx = canvas.getContext("2d")!;

      ctx.drawImage(img, 0, 0);

      // Soft shadow blending the photo into the card, then the solid card
      const blend = ctx.createLinearGradient(0, img.height - 24, 0, img.height);
      blend.addColorStop(0, "rgba(8,9,10,0)");
      blend.addColorStop(1, "rgba(8,9,10,0.9)");
      ctx.fillStyle = blend;
      ctx.fillRect(0, img.height - 24, canvas.width, 24);

      ctx.fillStyle = "rgba(8, 9, 10, 0.95)";
      ctx.fillRect(0, img.height, canvas.width, barHeight);

      // CIPHERA badge, top-right of the card
      const badgeFontSize = Math.max(13, Math.round(barHeight * 0.115));
      ctx.font = `700 ${badgeFontSize}px sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillStyle = "#e8b96a";
      const badgeText = "◈ CIPHERA VERIFIED";
      const badgeWidth = ctx.measureText(badgeText).width;
      ctx.fillText(badgeText, canvas.width - badgeWidth - padding, img.height + padding * 0.65);

      // Map thumbnail, left side
      const mapX = padding;
      const mapY = img.height + padding;
      drawMapThumbnail(ctx, mapX, mapY, mapSize);

      // Text block, right of the thumbnail
      const textX = mapX + mapSize + padding;
      const textMaxWidth = canvas.width - textX - padding;
      let cursorY = img.height + padding + badgeFontSize * 1.9;

      const titleFontSize = Math.max(19, Math.round(barHeight * 0.145));
      const bodyFontSize = Math.max(14, Math.round(barHeight * 0.105));

      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f5efe6";
      ctx.font = `700 ${titleFontSize}px sans-serif`;
      const titleText = geocode.title ?? "Location unavailable";
      ctx.fillText(truncateToWidth(ctx, titleText, textMaxWidth), textX, cursorY);
      cursorY += titleFontSize * 1.2;

      ctx.font = `400 ${bodyFontSize}px sans-serif`;
      ctx.fillStyle = "#b8b1a4";
      if (geocode.subtitle) {
        ctx.fillText(truncateToWidth(ctx, geocode.subtitle, textMaxWidth), textX, cursorY);
        cursorY += bodyFontSize * 1.45;
      }

      ctx.fillStyle = "#d8d2c6";
      const latText = geo ? `Lat ${geo.lat.toFixed(5)}°` : "Lat unavailable";
      ctx.fillText(latText, textX, cursorY);
      cursorY += bodyFontSize * 1.4;

      const lngText = geo ? `Long ${geo.lng.toFixed(5)}°` : "Long unavailable";
      ctx.fillText(lngText, textX, cursorY);
      cursorY += bodyFontSize * 1.4;

      const dt = new Date(image.payload.capturedAt);
      const dateText = dt.toLocaleString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const tzOffsetMin = -dt.getTimezoneOffset();
      const tzSign = tzOffsetMin >= 0 ? "+" : "-";
      const tzH = String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(2, "0");
      const tzM = String(Math.abs(tzOffsetMin) % 60).padStart(2, "0");
      ctx.fillStyle = "#8f8879";
      ctx.font = `400 ${bodyFontSize}px sans-serif`;
      ctx.fillText(`${dateText}  GMT ${tzSign}${tzH}:${tzM}`, textX, cursorY);

      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), "image/png")
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ciphera-${image.id}-geotag.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setCaptioning(false);
    }
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
            <div>
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

              <div className="flex flex-col gap-2 mt-3">
                {objectUrl && (
                  <a
                    href={objectUrl}
                    download={`ciphera-${image.id}.png`}
                    className="btn-secondary text-xs text-center block"
                  >
                    Download image
                  </a>
                )}
                <button
                  onClick={downloadWithGeotag}
                  disabled={captioning}
                  className="btn-secondary text-xs text-center block"
                >
                  {captioning ? "Preparing…" : "Download w/ geotag info"}
                </button>
              </div>
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

              <div className="glass rounded-xl p-5">
                <h2 className="font-display text-lg mb-3">Location · geotag</h2>
                {image.payload.geo ? (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 font-mono text-xs">
                    <dt className="text-muted">latitude</dt>
                    <dd>{image.payload.geo.lat.toFixed(6)}</dd>
                    <dt className="text-muted">longitude</dt>
                    <dd>{image.payload.geo.lng.toFixed(6)}</dd>
                    {image.payload.geo.accuracy != null && (
                      <>
                        <dt className="text-muted">accuracy</dt>
                        <dd>±{Math.round(image.payload.geo.accuracy)} m</dd>
                      </>
                    )}
                    <dt className="text-muted">fix time</dt>
                    <dd>{new Date(image.payload.geo.capturedAt).toLocaleString()}</dd>
                    <dt className="text-muted">map</dt>
                    <dd>
                      <a
                        className="text-thread-teal hover:underline break-all"
                        href={`https://www.google.com/maps/search/?api=1&query=${image.payload.geo.lat},${image.payload.geo.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        open in Maps
                      </a>
                    </dd>
                  </dl>
                ) : (
                  <p className="text-muted text-xs font-mono">
                    No location was recorded for this capture (location
                    permission off, or unavailable at capture time).
                  </p>
                )}
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