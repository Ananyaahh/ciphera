"use client";

import { useEffect, useRef } from "react";
import { useIsTouch, usePrefersReducedMotion } from "@/lib/useTheme";

/**
 * A two-layer cursor — a precise inner point that tracks instantly and an
 * outer ring that trails with inertia — adapted from the reference. It grows
 * over interactive targets, is fully theme-aware (colours come from CSS vars),
 * and is disabled entirely on touch / coarse-pointer devices and under
 * reduced-motion, where the native cursor and normal touch interaction stay.
 */
export default function CustomCursor() {
  const innerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const touch = useIsTouch();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (touch || reduced) return;
    const inner = innerRef.current;
    const outer = outerRef.current;
    if (!inner || !outer) return;

    document.documentElement.classList.add("has-custom-cursor");

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let ox = x;
    let oy = y;
    let raf = 0;
    let visible = false;

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      inner.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      if (!visible) {
        visible = true;
        inner.style.opacity = "1";
        outer.style.opacity = "1";
      }
    };
    const onLeave = () => {
      visible = false;
      inner.style.opacity = "0";
      outer.style.opacity = "0";
    };
    const onDown = () => outer.classList.add("cursor-down");
    const onUp = () => outer.classList.remove("cursor-down");

    const interactiveSel =
      'a, button, input, textarea, select, label, [role="button"], [tabindex]:not([tabindex="-1"]), .cursor-grow';
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest(interactiveSel)) outer.classList.add("cursor-hover");
      else outer.classList.remove("cursor-hover");
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      ox += (x - ox) * 0.18;
      oy += (y - oy) * 0.18;
      outer.style.transform = `translate(${ox}px, ${oy}px) translate(-50%, -50%)`;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.documentElement.classList.remove("has-custom-cursor");
    };
  }, [touch, reduced]);

  if (touch || reduced) return null;

  return (
    <>
      <div ref={innerRef} className="cursor-inner" aria-hidden="true" />
      <div ref={outerRef} className="cursor-outer" aria-hidden="true" />
    </>
  );
}
