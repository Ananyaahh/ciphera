import type { Theme } from "@/lib/theme";

export type RGB = [number, number, number];

/**
 * The cinematic scene's colour scheme, taken directly from the reference
 * (index-4.html) liquid-metal wave shader: a scroll-driven journey from a
 * warm BRONZE / copper palette into a cool BLUE-STEEL palette, with polished
 * metallic crests, over a near-black ground.
 *
 * Reference values (GLSL vec3, lines 432-441 of index-4.html):
 *   c0_shadow (0.0010, 0.0006, 0.0004)  deepest bronze shadow
 *   c0_wave1  (0.085,  0.040,  0.015)   rich copper-bronze
 *   c0_wave2  (0.050,  0.022,  0.008)   deep bronze body
 *   c0_crest  (0.45,   0.30,   0.18)    polished bronze/gold sheen
 *   c1_shadow (0.0004, 0.0006, 0.0012)  deep blue shadow
 *   c1_wave1  (0.015,  0.035,  0.065)   blue
 *   c1_wave2  (0.008,  0.020,  0.045)   deep blue body
 *   c1_crest  (0.18,   0.35,   0.55)    polished blue-steel sheen
 *
 * DARK mode reproduces those numbers exactly. LIGHT mode is the same bronze→
 * blue scheme lit like polished metal in a bright gallery — warm ivory ground
 * with visible bronze and steel-blue, not a sterile white wash.
 */
export interface ScenePalette {
  /** Deepest background / shadow colour of the wave field. */
  shadow: RGB;
  /** Body of the wave, palette A (start of scroll → BRONZE). */
  waveA1: RGB;
  waveA2: RGB;
  crestA: RGB;
  /** Body of the wave, palette B (end of scroll → BLUE). */
  waveB1: RGB;
  waveB2: RGB;
  crestB: RGB;
  /** Particle / digital-dust tints. */
  sparkWarm: RGB;
  sparkCool: RGB;
  /** Aperture point-cloud gradient (inner → outer). */
  ringInner: RGB;
  ringMid: RGB;
  ringOuter: RGB;
  /** Overall exposure multiplier applied in the final composite. */
  exposure: number;
  /** How strongly the wave crests glow. */
  crestGain: number;
  /** Vignette strength (0 = none). */
  vignette: number;
}

// ── DARK: the reference's exact bronze → blue liquid-metal palette ──────────
const DARK: ScenePalette = {
  shadow: [0.0008, 0.0006, 0.0006], // near-black (mean of the two ref shadows)
  waveA1: [0.085, 0.04, 0.015], // c0_wave1  rich copper-bronze
  waveA2: [0.05, 0.022, 0.008], // c0_wave2  deep bronze body
  crestA: [0.45, 0.3, 0.18], // c0_crest  polished bronze/gold sheen
  waveB1: [0.015, 0.035, 0.065], // c1_wave1  blue
  waveB2: [0.008, 0.02, 0.045], // c1_wave2  deep blue body
  crestB: [0.18, 0.35, 0.55], // c1_crest  polished blue-steel sheen
  sparkWarm: [0.72, 0.52, 0.28], // bronze/gold dust
  sparkCool: [0.4, 0.58, 0.82], // steel-blue dust
  ringInner: [0.78, 0.56, 0.3], // bright bronze core
  ringMid: [0.5, 0.46, 0.42], // metal transition
  ringOuter: [0.28, 0.48, 0.72], // steel-blue edge
  exposure: 1.0,
  crestGain: 1.4, // reference multiplies crest by 1.4
  vignette: 0.16,
};

// ── LIGHT: same bronze → blue scheme with full depth — bright ivory ground,
//    genuinely saturated bronze/steel wave bodies as "grooves", luminous
//    crests. Same visual presence as dark, translated to a light key. ───────
const LIGHT: ScenePalette = {
  shadow: [0.93, 0.9, 0.84], // bright warm ivory ground (the flat highlights)
  waveA1: [0.82, 0.6, 0.33], // warm bronze ridge
  waveA2: [0.56, 0.38, 0.18], // deep bronze groove (the depth / dark bands)
  crestA: [0.98, 0.82, 0.5], // luminous polished-gold crest
  waveB1: [0.5, 0.64, 0.83], // steel-blue ridge
  waveB2: [0.26, 0.4, 0.6], // deep steel-blue groove (depth)
  crestB: [0.74, 0.87, 1.0], // luminous blue-steel crest
  sparkWarm: [0.52, 0.35, 0.14], // bronze dust (reads on light)
  sparkCool: [0.2, 0.38, 0.6], // steel dust
  ringInner: [0.62, 0.43, 0.2], // bronze
  ringMid: [0.46, 0.43, 0.45], // neutral metal
  ringOuter: [0.24, 0.42, 0.64], // steel blue
  exposure: 1.0,
  crestGain: 0.7, // brighter highlights so the metal reads on a light key
  vignette: 0.08,
};

export function scenePalette(theme: Theme): ScenePalette {
  return theme === "light" ? LIGHT : DARK;
}

/** Linear interpolation between two palettes, for smooth theme transitions. */
export function lerpPalette(
  a: ScenePalette,
  b: ScenePalette,
  t: number
): ScenePalette {
  const l = (x: RGB, y: RGB): RGB => [
    x[0] + (y[0] - x[0]) * t,
    x[1] + (y[1] - x[1]) * t,
    x[2] + (y[2] - x[2]) * t,
  ];
  const n = (x: number, y: number) => x + (y - x) * t;
  return {
    shadow: l(a.shadow, b.shadow),
    waveA1: l(a.waveA1, b.waveA1),
    waveA2: l(a.waveA2, b.waveA2),
    crestA: l(a.crestA, b.crestA),
    waveB1: l(a.waveB1, b.waveB1),
    waveB2: l(a.waveB2, b.waveB2),
    crestB: l(a.crestB, b.crestB),
    sparkWarm: l(a.sparkWarm, b.sparkWarm),
    sparkCool: l(a.sparkCool, b.sparkCool),
    ringInner: l(a.ringInner, b.ringInner),
    ringMid: l(a.ringMid, b.ringMid),
    ringOuter: l(a.ringOuter, b.ringOuter),
    exposure: n(a.exposure, b.exposure),
    crestGain: n(a.crestGain, b.crestGain),
    vignette: n(a.vignette, b.vignette),
  };
}
