"use client";

import { useEffect, useState } from "react";
import type { Theme } from "@/lib/theme";

/**
 * Reads CIPHERA's existing light/dark toggle.
 *
 * The toggle (AnimatedThemeToggler) mutates `document.documentElement`'s
 * class list directly and persists to localStorage under "ciphera-theme".
 * This hook is a *read-only* observer of that single source of truth — it
 * never writes the theme, so the original toggle stays the master
 * controller. Every cinematic layer (WebGL scene, grid, cursor) subscribes
 * through here so the whole experience recolours coherently when the user
 * flips the switch.
 */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const read = (): Theme =>
      document.documentElement.classList.contains("light") ? "light" : "dark";
    setTheme(read());

    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

/** True on touch-primary / coarse-pointer devices (no hover cursor). */
export function useIsTouch(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const read = () => setTouch(mq.matches);
    read();
    mq.addEventListener?.("change", read);
    return () => mq.removeEventListener?.("change", read);
  }, []);
  return touch;
}

/** Respects the OS "reduce motion" accessibility preference. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(mq.matches);
    read();
    mq.addEventListener?.("change", read);
    return () => mq.removeEventListener?.("change", read);
  }, []);
  return reduced;
}
