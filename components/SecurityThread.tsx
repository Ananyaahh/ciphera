"use client";

/**
 * The signature visual for CIPHERA: a woven thread with a repeating
 * micro-printed serial, styled after the security thread embedded in a
 * banknote. Every instance is seeded with a different serial so that,
 * true to the product's own premise, no two renders of the thread on the
 * page are quite identical.
 */
function deterministicSerial(input: string): string {
  // A small non-cryptographic hash, just to get a stable hex-looking
  // string per label without relying on client-only randomness (which
  // caused a server/client hydration mismatch).
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = (h1 ^ (h1 >>> 16)) >>> 0;
  h2 = (h2 ^ (h2 >>> 16)) >>> 0;
  const hex = h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  return hex.toUpperCase().slice(0, 12);
}

export default function SecurityThread({
  seed,
  className = "",
  label = "CIPHERA",
}: {
  seed?: string;
  className?: string;
  label?: string;
}) {
  const serial = seed ?? deterministicSerial(label);

  const repeated = Array.from({ length: 6 })
    .map(() => `${label} · ${serial} ·`)
    .join(" ");

  return (
    <div className={`relative w-full overflow-hidden ${className}`} aria-hidden="true">
      <svg viewBox="0 0 1200 60" className="w-full h-auto" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`thread-grad-${serial}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(var(--color-thread-teal))" />
            <stop offset="45%" stopColor="rgb(var(--color-thread-indigo))" />
            <stop offset="100%" stopColor="rgb(var(--color-thread-violet))" />
          </linearGradient>
          <path
            id={`thread-path-${serial}`}
            d="M 0 30 Q 150 5, 300 30 T 600 30 T 900 30 T 1200 30"
            fill="none"
          />
        </defs>
        <path
          d="M 0 30 Q 150 5, 300 30 T 600 30 T 900 30 T 1200 30"
          fill="none"
          stroke={`url(#thread-grad-${serial})`}
          strokeWidth="1.25"
          opacity="0.85"
        />
        <text
          fill="#0A0B0D"
          fontFamily="var(--font-plex-mono)"
          fontSize="9"
          letterSpacing="2"
        >
          <textPath href={`#thread-path-${serial}`} startOffset="0%">
            {repeated}
          </textPath>
        </text>
        <text
          fill="none"
          stroke={`url(#thread-grad-${serial})`}
          strokeWidth="0.5"
          fontFamily="var(--font-plex-mono)"
          fontSize="9"
          letterSpacing="2"
          opacity="0.9"
        >
          <textPath href={`#thread-path-${serial}`} startOffset="0%">
            {repeated}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
