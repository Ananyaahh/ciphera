"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/useTheme";

/**
 * A restrained technical grid — fixed vertical rules, a header datum line and
 * markers that drift with scroll. For a provenance product it quietly reads as
 * alignment, tracking and verification. Colours are theme-aware CSS vars; the
 * whole layer is inert to pointer input and simplifies on mobile / under
 * reduced-motion.
 */
export default function GridOverlay() {
  const reduced = usePrefersReducedMotion();
  const [cols, setCols] = useState(5);
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const read = () =>
      setCols(window.innerWidth < 640 ? 3 : window.innerWidth < 1024 ? 4 : 5);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let visible = true;
    const onVis = () => (visible = document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const top = window.scrollY || window.pageYOffset || 0;
      const scroll = max > 0 ? top / max : 0;
      dotRefs.current.forEach((dot, i) => {
        if (!dot) return;
        const startY = ((i * 17) % 80) + 10;
        let speed = 60 + ((i * 55) % 140);
        if (i % 2 === 0) speed = -speed;
        let yy = startY + scroll * speed;
        yy = (((yy % 100) + 100) % 100);
        dot.style.top = `${yy}%`;
      });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced, cols]);

  return (
    <div className="grid-overlay" aria-hidden="true">
      <div className="grid-datum" />
      <div className="grid-cols">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="grid-col">
            <div
              className="grid-dot"
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
              style={{ top: `${((i * 17) % 80) + 10}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
