import Nav from "@/components/Nav";
import LayerMarquee from "@/components/LayerMarquee";
import WhatYouGetWheel from "@/components/WhatYouGetWheel";
import DemoVideoButton from "@/components/DemoVideoButton";
import GlitchText from "@/components/GlitchText";
import ShinyText from "@/components/reactbits/ShinyText";
import ApertureCore from "@/components/scene/ApertureCore";
import { Reveal, RevealText } from "@/components/scene/Reveal";
import Link from "next/link";

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero — cinematic, asymmetric, spatial */}
        <section className="relative min-h-[92vh] flex items-center px-6 sm:px-10 pt-16 pb-24 overflow-hidden">
          {/* 3D centrepiece: capture aperture / fingerprint whorl */}
          <ApertureCore className="pointer-events-none absolute inset-y-0 right-[-8%] w-[92%] sm:w-[62%] opacity-70 sm:opacity-100" />
          <div className="pointer-events-none absolute inset-0 sm:hidden veil-soft" />

          <div className="relative mx-auto w-full max-w-6xl">
            <div className="max-w-3xl">
              <Reveal>
                <p className="eyebrow text-thread-teal mb-8">
                  Capture-time image provenance
                </p>
              </Reveal>
              <h1 className="font-display editorial leading-[0.92] text-[4rem] sm:text-[8rem] tracking-tight text-glow">
                <ShinyText
                  text="CIPHERA"
                  speed={2.5}
                  delay={1}
                  color="rgb(var(--color-paper))"
                  shineColor="rgb(var(--color-thread-teal))"
                  spread={100}
                  direction="left"
                />
              </h1>
              <Reveal delay={0.1}>
                <p className="mt-4 font-display italic text-2xl sm:text-4xl text-thread-indigo">
                  Capture. Verify. Trust.
                </p>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="mt-8 max-w-xl text-muted text-lg leading-relaxed">
                  Every photo carries proof of where it came from, sealed the
                  instant you take it. Share it, save it, send it anywhere — that
                  proof travels with the image.
                </p>
              </Reveal>
              <Reveal delay={0.3}>
                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-full bg-thread-gradient bg-[length:200%_100%] text-ink-950 font-medium px-6 py-3 hover:animate-weave transition"
                  >
                    Begin enrollment
                  </Link>
                  <Link
                    href="/gallery"
                    className="inline-flex items-center gap-2 rounded-full border border-ink-600 px-6 py-3 text-sm hover:border-thread-teal hover:text-thread-teal transition"
                  >
                    Verify a photo
                  </Link>
                  <DemoVideoButton />
                </div>
              </Reveal>
            </div>
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.35em] text-muted/70 flex items-center gap-2">
            <span className="w-px h-6 bg-gradient-to-b from-transparent to-thread-teal/60 animate-pulseThin" />
            Scroll
          </div>
        </section>

        {/* Mission statement */}
        <section className="relative px-6 sm:px-10 py-28 overflow-hidden">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <p className="eyebrow text-thread-teal mb-6">Capture meets proof</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="font-display editorial text-3xl sm:text-6xl leading-[1.06] max-w-3xl">
                A photograph is only as{" "}
                <GlitchText text="trustworthy" className="italic text-thread-indigo" />{" "}
                as the moment it was taken.
              </h2>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="mt-8 max-w-md text-muted leading-relaxed ml-auto text-right sm:text-lg">
                We seal proof into every image the instant it's captured — not
                added later, not bolted on after the fact.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Why CIPHERA */}
        <section className="border-t hairline px-6 sm:px-10 py-20">
          <div className="mx-auto max-w-5xl grid md:grid-cols-[1fr_1.4fr] gap-12">
            <Reveal>
              <h2 className="font-display editorial text-2xl sm:text-3xl italic text-thread-violet">
                Why CIPHERA?
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="space-y-4 text-muted leading-relaxed sm:text-lg">
                <p>A photo is only worth trusting if you can prove where it came from.</p>
                <p>
                  CIPHERA does that automatically, the moment you take the
                  picture — no extra app to open, no extra step to remember.
                </p>
                <p>From then on, that photo can always answer for itself.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* What you get */}
        <section className="border-t hairline px-6 sm:px-10 py-20">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <h2 className="font-display editorial text-2xl sm:text-3xl italic text-thread-violet mb-10">
                What you get
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <WhatYouGetWheel />
            </Reveal>
          </div>
        </section>

        {/* Layers pipeline */}
        <section className="border-t hairline px-6 sm:px-10 py-20">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <h2 className="font-display editorial text-2xl sm:text-3xl italic text-thread-violet mb-2">
                The chain of evidence
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="text-muted max-w-2xl mb-14 sm:text-lg">
                Five steps, one unbroken chain. The same live scan that proves
                you're there is the scan that seeds the proof. Skip a step, and
                the whole thing breaks with it.
              </p>
            </Reveal>
            <LayerMarquee />
          </div>
        </section>

        {/* Verify any photo */}
        <section className="border-t hairline px-6 sm:px-10 py-20">
          <div className="mx-auto max-w-5xl grid md:grid-cols-[1fr_1.4fr] gap-12">
            <Reveal>
              <h2 className="font-display editorial text-2xl sm:text-3xl italic text-thread-violet">
                Verify any photo with confidence
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="space-y-4 text-muted leading-relaxed sm:text-base">
                <p>
                  Every photo raises the same four questions: who captured it,
                  when, whether it's been altered, and whether you can trust
                  what you're looking at. CIPHERA answers all four in a single
                  check — instantly, with no special tools and nothing
                  technical to understand. Whether it's a photo you took
                  yourself or one someone sent you, the answer is always just a
                  tap away.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t hairline px-6 sm:px-10 py-28">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <RevealText
                as="h2"
                text="Trust should travel with every photograph."
                className="font-display editorial text-3xl sm:text-5xl italic text-thread-violet mb-6 leading-[1.08]"
                stagger={0.02}
              />
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-muted leading-relaxed mb-10 sm:text-lg">
                A photograph is a claim about what happened. CIPHERA is what
                makes that claim hold up — long after the moment has passed, no
                matter where the image ends up.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-thread-gradient bg-[length:200%_100%] text-ink-950 font-medium px-6 py-3 hover:animate-weave transition"
              >
                Get started
              </Link>
            </Reveal>
          </div>
        </section>
      </main>
      <footer className="border-t hairline px-6 sm:px-10 py-8">
        <div className="mx-auto max-w-5xl flex items-center justify-between text-xs text-muted font-mono uppercase tracking-[0.18em]">
          <span>CIPHERA</span>
          <span>Proof, at the moment of capture.</span>
        </div>
      </footer>
    </>
  );
}
