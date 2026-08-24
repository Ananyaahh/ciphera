"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ciphera-theme";

export function AnimatedThemeToggler({ className }: { className?: string }) {
  const [isLight, setIsLight] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Sync with whatever the no-flash boot script already applied.
  useEffect(() => {
    setIsLight(document.documentElement.classList.contains("light"));
  }, []);

  const toggleTheme = async () => {
    const apply = () => {
      const light = document.documentElement.classList.toggle("light");
      setIsLight(light);
      try {
        window.localStorage.setItem(STORAGE_KEY, light ? "light" : "dark");
      } catch {
        // localStorage unavailable (private browsing etc.) -- fine, the
        // toggle still works for the rest of the session.
      }
    };

    const startViewTransition = (document as any).startViewTransition?.bind(
      document
    );

    if (!startViewTransition || !buttonRef.current) {
      apply();
      return;
    }

    const transition = startViewTransition(() => {
      flushSync(apply);
    });
    await transition.ready;

    const { top, left, width, height } = buttonRef.current.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const right = window.innerWidth - left;
    const bottom = window.innerHeight - top;
    const maxRadius = Math.hypot(Math.max(left, right), Math.max(top, bottom));

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 600,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  };

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className={cn(
        "inline-flex items-center justify-center w-9 h-9 rounded-full border border-ink-600 text-paper hover:border-thread-teal hover:text-thread-teal transition-colors",
        className
      )}
    >
      {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  );
}
