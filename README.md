# CIPHERA

Cancellable-biometric, capture-time watermarking for non-repudiable image
provenance — a working web build of the architecture in
`CIPHERA_ARCH.docx`.

Flow: **Landing → Login/Signup (password + OTP + fingerprint) → Camera
(liveness-gated shutter) → Gallery (one-tap verification).**

## What's real vs. simulated in this build

This is a genuine, working Next.js app — everything runs and nothing is
mocked UI-only — but it's a **browser-only demo of the architecture's causal
chain**, not the hardened production system the paper describes. Read this
before treating any part of it as a security guarantee:

| Architecture piece | This build | Production would need |
|---|---|---|
| L1 fingerprint capture | Device platform authenticator (Touch ID / Windows Hello / Android fingerprint) via **WebAuthn** — browsers don't expose raw fingerprint sensors to web pages | A real sensor SDK on native iOS/Android |
| Cancellable transform + fuzzy extractor | Simulated: each key-epoch gets fresh public "helper data"; revocation rotates the epoch (`lib/auth.ts`) | An actual cancellable-biometric transform + fuzzy extractor library |
| TEE-backed key attestation | A non-extractable ECDSA P-256 keypair generated with WebCrypto and stored in IndexedDB (`lib/db.ts`) | Android Key Attestation / Apple Secure Enclave |
| Per-image HKDF derivation | Real WebCrypto HKDF over image hash + timestamp + nonce (`lib/crypto.ts`) | Same, just running against real biometric-derived IKM |
| Dual watermark (robust + fragile) | Real, working LSB steganography: redundant majority-vote payload (robust) + self-referential hash layer (fragile) — see `lib/watermark.ts` | A GAN-hardened encoder/decoder trained against removal attacks; robust survival of real JPEG re-encoding needs frequency-domain embedding, not LSB |
| Signing / non-repudiation | Real ECDSA signatures over the payload hash, verifiable with the stored public key (`lib/crypto.ts`, `lib/verify.ts`) | Same, ideally signed inside the TEE |
| Provenance ledger | Real hash-chained, append-only log — but stored in this browser's `localStorage`, so *this device* is currently the only party | A permissioned blockchain or Certificate-Transparency-style Merkle log run by multiple parties, so no single operator can rewrite it |
| OTP | Generated and shown on-screen, clearly labeled demo | A real SMS/email provider |

Because the watermark lives in pixel LSBs, **captured images are stored as
PNG**, not JPEG — re-encoding to JPEG would destroy the mark. This is stated
plainly rather than hidden.

## Architecture → code map

- **§Layer 1 Enrollment** — `lib/webauthn.ts` (`enrollBiometric`), `lib/auth.ts` (`createAccount`, `createEpoch`), `app/login/page.tsx`
- **§Layer 2 Capture-time auth** — `lib/webauthn.ts` (`verifyLiveness`), `lib/auth.ts` (capture-window functions), `app/camera/page.tsx`
- **§Layer 3 Capture & embedding** — `lib/crypto.ts` (`hkdf`), `lib/watermark.ts` (`embedWatermark`), `app/camera/page.tsx`
- **§Layer 4 Provenance anchoring** — `lib/ledger.ts`
- **§Layer 5 Verification** — `lib/verify.ts`, `app/gallery/page.tsx`, `app/gallery/[id]/page.tsx`
- **§3.1 Session liveness window** — `lib/auth.ts` (`openCaptureWindow`, `consumeCaptureFrame`, `SESSION_WINDOW_MS`, `SESSION_WINDOW_MAX_FRAMES`)
- **§3.2 Key-epoch versioning** — `lib/auth.ts` (`revokeAndRotateEpoch`, `KeyEpoch`), `lib/types.ts`

## Project structure

```
ciphera/
├── app/
│   ├── layout.tsx            # fonts + global shell
│   ├── globals.css           # design tokens, utility classes
│   ├── page.tsx              # landing page
│   ├── login/page.tsx        # signup/signin: credentials → OTP → biometric
│   ├── camera/page.tsx       # liveness-gated shutter + embedding
│   └── gallery/
│       ├── page.tsx          # grid + ledger integrity banner + upload-to-verify
│       └── [id]/page.tsx     # single image detail + verify + tamper demo
├── components/
│   ├── Nav.tsx
│   ├── SecurityThread.tsx    # signature animated watermark-thread visual
│   └── VerificationCard.tsx
├── lib/
│   ├── types.ts              # shared domain types
│   ├── crypto.ts              # hashing, HKDF, ECDSA sign/verify, PBKDF2
│   ├── webauthn.ts            # biometric enrollment + liveness check
│   ├── watermark.ts           # robust + fragile invisible watermark
│   ├── ledger.ts              # hash-chained provenance log
│   ├── auth.ts                # users, epochs, OTP, capture window
│   ├── db.ts                  # IndexedDB (image blobs, device keys)
│   ├── image.ts                # blob ↔ ImageData helpers
│   └── verify.ts              # Layer 5 verification pipeline
├── public/
├── package.json
├── tailwind.config.ts
├── next.config.mjs
└── tsconfig.json
```

## Demo video

The landing page hero has a "See in action" button that opens the demo
clip in a lightbox (`components/DemoVideoButton.tsx`). Drop your file in
at:

```
public/videos/demo.mp4
```

That's it — it's referenced by path (`/videos/demo.mp4`), no import or
build step needed.

**A note on size:** anything committed to `public/` ships as a static
asset and gets included in your git repo. That's fine for a clip in the
tens of MB. If your recording is large (say, north of ~50–80MB) or you
want adaptive streaming / faster first-frame load, it's worth hosting it
externally instead — Vercel Blob, Cloudflare Stream, Mux, or even an
unlisted YouTube/Vimeo embed — and swapping the `<video src="...">` in
`DemoVideoButton.tsx` for that URL (or an `<iframe>` if you go the
YouTube/Vimeo route).

## Running locally

```bash
npm install
npm run dev
```

Open `https://localhost:3000` — **WebAuthn platform authenticators require
either `localhost` or HTTPS**, so plain `http://` on a non-localhost host
won't be able to enroll a biometric. `npm run dev` on `localhost` is fine.

## Deploying to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, "Add New Project" → import that repo. Framework preset
   `Next.js` is auto-detected; no environment variables are required.
3. Deploy. Vercel serves over HTTPS by default, so WebAuthn will work on
   the deployed URL immediately.
4. Because everything (users, ledger, images) is stored in `localStorage`
   / IndexedDB in the visitor's own browser, there's no database to
   provision — but that also means data doesn't sync across devices or
   browsers. That's the natural next step if you want to take this past a
   demo (see table above).

## Browser support notes

- Needs a browser with WebAuthn platform authenticator support and a
  device with Touch ID, Windows Hello, or a fingerprint sensor (most
  modern laptops and phones). Desktop Chrome/Edge/Safari and mobile
  Safari/Chrome are all fine.
- Needs camera permission for `app/camera`.
- Needs IndexedDB (all evergreen browsers).
