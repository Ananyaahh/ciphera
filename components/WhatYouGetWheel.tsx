"use client";

import { useMemo, useState } from "react";
import OptionWheel from "@/components/reactbits/OptionWheel";

const BENEFITS = [
  {
    title: "Capture-time verification",
    body: "The moment you press the shutter, CIPHERA confirms it's really you taking the photo — not just that your phone happens to be unlocked.",
  },
  {
    title: "Tamper detection",
    body: "If a photo is edited after it's captured, CIPHERA can tell. The proof breaks the instant the image changes, so alterations don't go unnoticed.",
  },
  {
    title: "Built-in provenance",
    body: "Every photo remembers who took it and when — permanently. That history travels with the image itself, wherever it's shared.",
  },
  {
    title: "Privacy first",
    body: "Your fingerprint never leaves your device and is never stored as an image. CIPHERA proves it's you without ever holding on to the print itself.",
  },
];

export default function WhatYouGetWheel() {
  const [selected, setSelected] = useState(0);
  const items = useMemo(() => BENEFITS.map((b) => b.title), []);

  return (
    <div className="grid md:grid-cols-[minmax(0,300px)_1fr] gap-8 md:gap-12 items-center rounded-2xl glass p-6 sm:p-8">
      <div className="relative h-56 sm:h-64">
        <OptionWheel
          items={items}
          defaultSelected={0}
          selectedIndex={selected}
          textColor="rgb(var(--color-muted))"
          activeColor="rgb(var(--color-thread-teal))"
          side="left"
          fontSize={1.05}
          spacing={1.7}
          curve={1}
          tilt={11}
          blur={1.5}
          fade={0.4}
          inset={4}
          loop
          draggable
          className="font-mono"
          onChange={(index: number) => setSelected(index)}
        />
      </div>
      <div key={selected} className="animate-fadeIn">
        <p className="font-mono text-xs uppercase tracking-widest text-thread-teal mb-2">
          {BENEFITS[selected].title}
        </p>
        <p className="text-muted leading-relaxed max-w-md">
          {BENEFITS[selected].body}
        </p>
      </div>
    </div>
  );
}
