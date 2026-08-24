"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/login", label: "Enroll / Sign in" },
  { href: "/camera", label: "Camera" },
  { href: "/gallery", label: "Gallery" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 glass hairline border-b">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="relative flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-thread-teal shadow-[0_0_12px_2px_rgba(212,170,120,0.55)] group-hover:animate-pulseThin" />
            <span className="absolute w-4 h-4 rounded-full border border-thread-teal/30 group-hover:border-thread-teal/60 transition-colors" />
          </span>
          <span className="font-display text-lg tracking-[0.35em] uppercase pl-1">
            CIPHERA
          </span>
        </Link>
        <nav className="hidden sm:flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em]">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative px-3 py-2 rounded-full transition-colors ${
                  active ? "text-thread-teal" : "text-muted hover:text-paper"
                }`}
              >
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-px bg-thread-gradient" />
                )}
                {l.label}
              </Link>
            );
          })}
          <AnimatedThemeToggler className="ml-3" />
        </nav>
        <AnimatedThemeToggler className="sm:hidden" />
      </div>
    </header>
  );
}
