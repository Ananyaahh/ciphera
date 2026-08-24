"use client";

import {
  useRef,
  useLayoutEffect,
  useEffect,
  useState,
  type ElementType,
  type ReactNode,
} from "react";

function useInView<T extends HTMLElement>(once = true) {
  const ref = useRef<T>(null);
  const [armed, setArmed] = useState(false);
  const [inView, setInView] = useState(false);

  // Arm (hide) before first paint so there's no flash of the final state.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced || !("IntersectionObserver" in window)) {
      setInView(true); // show immediately, no animation
      return;
    }
    setArmed(true);
  }, []);

  useEffect(() => {
    if (!armed || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            if (once) io.unobserve(e.target);
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [armed, once]);

  return { ref, armed, inView };
}

/**
 * Per-character editorial reveal — characters resolve from blurred, offset and
 * transparent into place with a staggered cadence, echoing the reference's
 * title treatment. Reserved for major headings. Plain-string children only so
 * the exact wording is preserved verbatim; it is never rewritten, only
 * animated. Falls back to instant, fully-visible text under reduced-motion or
 * without IntersectionObserver.
 */
export function RevealText({
  text,
  as: Tag = "span",
  className = "",
  stagger = 0.03,
  delay = 0,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  const { ref, armed, inView } = useInView<HTMLElement>();
  // Split into words + the whitespace between them. Each word's characters are
  // grouped inside a non-breaking wrapper so a line can only break at spaces,
  // never in the middle of a word (e.g. "photograph"). The per-character
  // stagger is preserved by threading a single running index across words.
  const tokens = text.split(/(\s+)/); // keeps the separators
  let i = 0;
  return (
    <Tag
      ref={ref as never}
      className={`reveal-text ${armed ? "reveal-armed" : ""} ${
        inView ? "reveal-in" : ""
      } ${className}`}
    >
      {tokens.map((token, tIdx) => {
        if (token.length === 0) return null;
        if (/^\s+$/.test(token)) {
          // Whitespace token: a real breakable space between words.
          return <span key={`s${tIdx}`}> </span>;
        }
        const chars = Array.from(token);
        return (
          <span key={`w${tIdx}`} className="reveal-word">
            {chars.map((ch, idx) => {
              const d = delay + i * stagger;
              i++;
              return (
                <span
                  key={idx}
                  className="reveal-char"
                  style={{ transitionDelay: `${d}s` }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </Tag>
  );
}

/**
 * Block-level fade-up reveal for any content (headings with inline markup,
 * paragraphs, cards). Content stays fully intact; only its entrance is styled.
 */
export function Reveal({
  children,
  as: Tag = "div",
  className = "",
  delay = 0,
  once = true,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
  once?: boolean;
}) {
  const { ref, armed, inView } = useInView<HTMLElement>(once);
  return (
    <Tag
      ref={ref as never}
      className={`reveal-block ${armed ? "reveal-armed" : ""} ${
        inView ? "reveal-in" : ""
      } ${className}`}
      style={{ transitionDelay: `${delay}s` }}
    >
      {children}
    </Tag>
  );
}
