"use client";

import { cn } from "@/lib/utils";
import { Marquee } from "@/components/magicui/marquee";

const LAYERS = [
  {
    tag: "L1",
    title: "Enrollment",
    body: "Your fingerprint isn't stored. It's turned into a secure digital key — one that can be replaced if it's ever compromised, without ever exposing your real fingerprint.",
  },
  {
    tag: "L2",
    title: "Capture-time authentication",
    body: "The shutter checks who's pressing it, not who unlocked the phone an hour ago. If you're not there, live, right now, the photo doesn't happen.",
  },
  {
    tag: "L3",
    title: "Capture & embedding",
    body: "Every photo gets its own invisible signature, created the instant it's taken. That signature has two parts: one identifies who captured the image, the other stays hidden until someone tries to change it.",
  },
  {
    tag: "L4",
    title: "Provenance anchoring",
    body: "That proof gets written to a record no single party can rewrite — not an attacker, not even CIPHERA itself. Once it's in, it stays.",
  },
  {
    tag: "L5",
    title: "Verification",
    body: "Anyone can check a photo afterward: who took it, when, and whether it's still exactly as captured. No specialized tools. Just an answer.",
  },
];

const firstRow = LAYERS.slice(0, 3);
const secondRow = LAYERS.slice(3);

function LayerCard({
  tag,
  title,
  body,
}: {
  tag: string;
  title: string;
  body: string;
}) {
  return (
    <figure
      className={cn(
        "relative h-full w-80 shrink-0 cursor-default overflow-hidden rounded-xl border p-5",
        "glass hover:border-thread-teal/40 transition-colors"
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="shrink-0 w-9 h-9 rounded-full border border-ink-600 bg-ink-950 flex items-center justify-center font-mono text-[11px] text-thread-teal">
          {tag}
        </span>
        <figcaption className="font-display text-lg leading-tight">
          {title}
        </figcaption>
      </div>
      <blockquote className="text-sm text-muted leading-relaxed">
        {body}
      </blockquote>
    </figure>
  );
}

export default function LayerMarquee() {
  return (
    <div className="relative flex w-full flex-col items-center justify-center overflow-hidden gap-4">
      <Marquee pauseOnHover className="[--duration:32s]">
        {firstRow.map((layer) => (
          <LayerCard key={layer.tag} {...layer} />
        ))}
      </Marquee>
      <Marquee reverse pauseOnHover className="[--duration:32s]">
        {secondRow.map((layer) => (
          <LayerCard key={layer.tag} {...layer} />
        ))}
      </Marquee>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-ink-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-ink-950 to-transparent" />
    </div>
  );
}
