"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import { getCurrentUser } from "@/lib/auth";
import { getImagesForUser, deleteImage } from "@/lib/db";
import { verifyChainIntegrity } from "@/lib/ledger";
import { verifyImageData } from "@/lib/verify";
import { blobToImageData, blobToDataURL } from "@/lib/image";
import VerificationCard from "@/components/VerificationCard";
import CurvedRingArchive, { RingItem } from "@/components/blocks/CurvedRingArchive";
import SafeBoundary from "@/components/SafeBoundary";
import type { CipheraImage, CipheraUser, VerificationResult } from "@/lib/types";

export default function GalleryPage() {
  const router = useRouter();
  const [user, setUser] = useState<CipheraUser | null>(null);
  const [images, setImages] = useState<CipheraImage[]>([]);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<VerificationResult | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [siteTheme, setSiteTheme] = useState<"light" | "dark">("dark");
  const fileRef = useRef<HTMLInputElement>(null);

  // Track the site's light/dark toggle (it mutates documentElement directly,
  // not through React), so the ring's own theme prop stays in sync.
  useEffect(() => {
    const read = () =>
      setSiteTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);

    function refresh() {
      Promise.all([getImagesForUser(u!.id), verifyChainIntegrity()])
        .then(([imgs, chain]) => {
          setImages((imgs as CipheraImage[]).sort((a, b) => b.createdAt - a.createdAt));
          setChainOk(chain.ok);
          setLoadError(null);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load captures:", err);
          setLoadError("Couldn't load your captures. Try reloading the page.");
          setLoading(false);
        });
    }

    refresh();

    // If this tab was already open on /gallery before a capture happened
    // elsewhere (another tab, or navigating away and back), re-check
    // IndexedDB when the tab becomes visible/focused again instead of only
    // ever fetching once on the very first mount.
    function onVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  const [ringItems, setRingItems] = useState<RingItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const items: RingItem[] = await Promise.all(
        images.map(async (img) => ({
          id: img.id,
          image: await blobToDataURL(img.blob),
          capturedAt: img.createdAt,
          ledgerIndex: img.ledgerIndex,
          identityToken: img.payload.identityToken,
          epochNumber: img.payload.epochNumber,
          nonce: img.payload.nonce,
          imageHash: img.payload.imageHash,
        }))
      );
      // If `images` changed again before this finished (or the component
      // unmounted), drop this stale result instead of committing it.
      if (!cancelled) setRingItems(items);
    })();
    return () => {
      cancelled = true;
    };
  }, [images]);

  async function handleRingVerify(item: RingItem): Promise<VerificationResult> {
    const source = images.find((img) => img.id === item.id);
    if (!source) {
      return {
        status: "unverifiable",
        identityToken: null,
        username: null,
        capturedAt: null,
        epochNumber: null,
        epochStatus: null,
        ledgerMatch: false,
        fragileIntact: false,
        details: "Couldn't find that capture's original file.",
      };
    }
    const imageData = await blobToImageData(source.blob);
    return verifyImageData(imageData);
  }

  async function handleRingDelete(item: RingItem) {
    await deleteImage(item.id);
    setImages((prev) => prev.filter((img) => img.id !== item.id));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    setUploadResult(null);
    setUploadPreview(URL.createObjectURL(file));
    try {
      const imageData = await blobToImageData(file);
      const result = await verifyImageData(imageData);
      setUploadResult(result);
    } catch {
      setUploadResult({
        status: "unverifiable",
        identityToken: null,
        username: null,
        capturedAt: null,
        epochNumber: null,
        epochStatus: null,
        ledgerMatch: false,
        fragileIntact: false,
        details: "Couldn't read that file as an image.",
      });
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="px-6 py-10 bg-noise min-h-[calc(100vh-64px)]">
        <div className="mx-auto max-w-5xl">
          <p className="eyebrow text-thread-teal mb-2">
            Layer 5 · Verification
          </p>
          <h1 className="font-display editorial text-4xl mb-6">Gallery</h1>

          {chainOk !== null && (
            <div
              className={`mb-8 rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
                chainOk
                  ? "border-signal-verified/30 bg-signal-verified/10 text-signal-verified"
                  : "border-signal-tamper/30 bg-signal-tamper/10 text-signal-tamper"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {chainOk
                ? "Provenance ledger intact — the full hash chain verifies."
                : "Provenance ledger integrity check failed — the hash chain no longer verifies."}
            </div>
          )}

          <section className="mb-12 glass rounded-2xl p-6">
            <h2 className="font-display text-lg mb-1">Verify any image</h2>
            <p className="text-sm text-muted mb-4">
              Upload a file to check who captured it, when, and whether it's
              been altered since.
            </p>
            <div className="flex flex-col sm:flex-row gap-6">
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="btn-secondary"
                  disabled={uploadBusy}
                >
                  {uploadBusy ? "Checking…" : "Choose image"}
                </button>
                {uploadPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={uploadPreview}
                    alt=""
                    className="mt-4 max-w-[220px] rounded-lg border border-ink-700"
                  />
                )}
              </div>
              {uploadResult && <VerificationCard result={uploadResult} />}
            </div>
          </section>

          <h2 className="font-display text-lg mb-4">Your captures</h2>
          {loading ? (
            <p className="text-muted text-sm">Loading…</p>
          ) : loadError ? (
            <div className="rounded-2xl border border-signal-tamper/40 bg-signal-tamper/5 p-10 text-center">
              <p className="text-signal-tamper mb-4">{loadError}</p>
              <button onClick={() => window.location.reload()} className="btn-primary inline-block">
                Reload
              </button>
            </div>
          ) : images.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-700 p-10 text-center">
              <p className="text-muted mb-4">
                Nothing captured yet. Every photo you take gets its own
                invisible, verifiable thread.
              </p>
              <Link href="/camera" className="btn-primary inline-block">
                Open camera
              </Link>
            </div>
          ) : (
            <SafeBoundary
              fallback={
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ringItems.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => router.push(`/gallery/view?id=${it.id}`)}
                      className="block rounded-lg overflow-hidden border border-ink-700 hover:border-thread-teal"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.image} alt="" className="w-full aspect-square object-cover" />
                    </button>
                  ))}
                </div>
              }
            >
              <CurvedRingArchive
                theme={siteTheme}
                accent="orange"
                embedded
                items={ringItems}
                onVerify={handleRingVerify}
                onOpenFullDetail={(item) => router.push(`/gallery/view?id=${item.id}`)}
                onDelete={handleRingDelete}
              />
            </SafeBoundary>
          )}
        </div>
      </main>
    </>
  );
}
