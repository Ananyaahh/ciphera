# CIPHERA — Cinematic Visual Redesign

A **visual transformation** of the existing CIPHERA biometric‑authentication app,
inspired by the provided reference (fixed WebGL layer, editorial typography,
spatial layout, subtle grid, atmospheric motion, interactive depth, scroll‑driven
storytelling). **Functionality, content, wording, routing, authentication,
cryptography, biometrics, camera, watermarking, gallery, and the light/dark
toggle are unchanged.**

## What was preserved (source of truth = your app)
- Every `lib/*` file is **byte‑for‑byte identical** (auth, crypto, db, ledger,
  watermark, webauthn, verify, image, types, theme).
- Every user‑facing string is intact (all 100 original sentences verified).
- All page logic is unchanged — the only edits to `login`, `camera`, `gallery`,
  and the image‑detail page are **`className` changes** (no handlers, state,
  flows, or API calls touched).
- `package.json`, `package-lock.json`, and `tailwind.config.ts` are unchanged —
  **no new dependencies.** The 3D is built with `ogl`, already in your project
  (the same renderer your `LightRays` effect uses), rather than adding Three.js.

## The master theme toggle is sacred
The redesign is built **on top of** your existing mechanism: the toggle still
flips the `.light` class on `<html>` and persists to `localStorage["ciphera-theme"]`.
A read‑only hook (`lib/useTheme.ts`) observes that single source of truth so the
WebGL scene, grid, and cursor all recolour coherently. Dark mode follows the
reference's cinematic depth; light mode is a genuine light interpretation
(pearl/silver atmospherics), not an inversion. Colours cross‑fade on toggle.

## Visual mapping (existing → reference‑inspired treatment)
| Existing element | Cinematic treatment |
|---|---|
| Flat page background | Fixed, full‑viewport **liquid wave shader** + **depth particle field** (`CipheraScene`), theme‑aware, scroll‑ and cursor‑reactive, breathing slowly |
| Landing hero | Asymmetric editorial layout + **3D centrepiece** (`ApertureCore`): a capture‑aperture / fingerprint‑whorl point cloud — CIPHERA's own motifs, **not** the reference's phone/statue — that scroll rotates & dollies, the cursor tilts, and a scan sweep passes through |
| Headings | Editorial serif scale (Fraunces) with **per‑character blur reveal** and block fade‑ups (`Reveal`, `RevealText`) — wording never changes, only its entrance |
| Cards / panels | Translucent **glass** surfaces with hairline borders over the live backdrop |
| Nav | Floating glass header, letter‑spaced brand, thread underline on active route |
| Cursor (desktop) | Two‑layer custom cursor that grows over interactive targets |
| Whole app | Subtle technical **grid overlay** (rules + scroll‑drifting markers) reinforcing alignment/verification |

## Performance & accessibility
- One persistent WebGL context at the app root (survives route changes).
- DPR capped; particle budget scales down on mobile; renders pause when the tab
  is hidden or the layer scrolls off‑screen; GL resources are disposed on unmount.
- **`prefers-reduced-motion`** renders a single static frame and disables the
  custom cursor / char reveals.
- Touch / coarse‑pointer devices keep the native cursor and normal interaction.
- If WebGL is unavailable or a shader fails, the scene degrades gracefully to the
  themed CSS background — the app keeps working.

## New files (additive only)
```
lib/useTheme.ts               read-only theme/touch/reduced-motion hooks
lib/scenePalette.ts           theme-aware scene colour philosophy
components/scene/CipheraScene.tsx   fixed wave shader + particle backdrop (ogl)
components/scene/ApertureCore.tsx   landing 3D aperture/fingerprint centrepiece
components/scene/Reveal.tsx         per-char + block reveal typography
components/scene/CustomCursor.tsx   two-layer desktop cursor
components/scene/GridOverlay.tsx    editorial grid with scroll-drifting dots
components/scene/SceneRoot.tsx      mounts the global layers once
```
`app/globals.css` gained theme‑aware scene tokens + cinematic utility classes
(all resolve through your existing light/dark variables). `app/layout.tsx` adds
only `<SceneRoot/>` and an `.app-shell` wrapper — the font loading is unchanged.

## Run
```bash
npm install      # deps unchanged; restores the exact lockfile
npm run dev       # or: npm run build && npm start
```
