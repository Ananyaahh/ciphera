"use client";

import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";

export default function DemoVideoButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-full border border-ink-600 px-6 py-3 text-sm hover:border-thread-teal hover:text-thread-teal transition"
        }
      >
        <Play className="w-3.5 h-3.5" />
        See in action
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="CIPHERA demo video"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/90 backdrop-blur-sm p-4 sm:p-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl rounded-2xl overflow-hidden border border-ink-700 bg-ink-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close video"
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-ink-950/80 border border-ink-600 flex items-center justify-center hover:border-thread-teal hover:text-thread-teal transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <video
              src="/videos/demo.mp4"
              controls
              autoPlay
              playsInline
              className="w-full h-auto block bg-ink-950"
            />
          </div>
        </div>
      )}
    </>
  );
}
