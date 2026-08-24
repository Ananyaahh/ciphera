# What changed & what you need to do

Three changes were made to the project:

1. **Removed the floating cursor ring** ("points icon"). The custom cursor is no
   longer mounted, so the normal OS pointer is back. Nothing else to do.
2. **Real phone / SMS OTP** — added server routes and wired the enrollment flow
   to them. Works in a safe *demo mode* out of the box; add Twilio credentials to
   send real texts.
3. **Continue with Google** — added a Google button on the enrollment/sign-in
   screen plus a server route that verifies Google's token. Needs a Google OAuth
   client id to appear.

Both auth features need a **server + third-party accounts** — they can't be done
purely in the browser, because the whole point of an SMS code or a Google login
is that a secret (your Twilio token / OAuth client) lives on the server where the
user can't read or fake it. Your app is a normal Next.js app, so the new
`app/api/...` routes give you exactly that server side. No new npm packages were
added.

---

## 1. Phone / OTP (Twilio Verify)

Files added: `app/api/otp/send/route.ts`, `app/api/otp/verify/route.ts`,
`lib/otpServer.ts`. The login page now collects a phone number on enrollment and
verifies the code against the server.

**Demo mode (default):** with no credentials set, the server generates the code
and the screen shows it — same as before, but now checked server-side.

**To send real SMS:**
1. Create a Twilio account: https://www.twilio.com/try-twilio
2. In the console, open **Verify → Services → Create new** and copy its
   **Service SID** (starts with `VA...`).
3. Copy your **Account SID** and **Auth Token** from the console dashboard.
4. Put all three in `.env.local` (see `.env.local.example`):
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxx
   TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxx
   ```
5. Restart `npm run dev`. Phone numbers must be entered in international format,
   e.g. `+14155552671`. (Trial accounts can only text *verified* numbers — add
   your own number under **Verified Caller IDs** while testing.)

Twilio handles code generation, expiry, and rate-limiting for you, so there's no
OTP secret stored in your app.

---

## 2. Continue with Google

Files added: `app/api/auth/google/route.ts`. The login page loads Google's
official button and, on success, verifies the token server-side then creates (or
loads) a local Ciphera account for that Google identity and continues to the
biometric step.

**To enable it:**
1. Go to https://console.cloud.google.com/ and create/select a project.
2. **APIs & Services → OAuth consent screen** — configure it (External is fine
   for testing; add your Google account as a test user).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   type **Web application**.
4. Under **Authorized JavaScript origins** add the origins you run on, e.g.
   `http://localhost:3000` (and your production URL later).
5. Copy the generated **Client ID** and put it in `.env.local` in BOTH vars:
   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   ```
6. Restart `npm run dev`. The "Continue with Google" button now appears on the
   enroll / sign-in screen. Until the id is set, a small placeholder note shows
   where the button will be.

No client *secret* is needed for this flow — it uses Google Identity Services
(an ID token), which the server validates against your client id.

---

## Notes / things to decide later

- **Persistence:** accounts still live in the browser (`localStorage`/IndexedDB),
  which is how the original demo worked. Only OTP sending/checking and Google
  token verification are now server-side. For multi-device, real accounts you'd
  move the user store into a database behind these same API routes.
- **Demo OTP store** uses server memory and resets when the dev server restarts;
  that only matters in demo mode. Real Twilio mode is unaffected.
- Never commit `.env.local`. Set the same variables in your host's dashboard
  (Vercel/Netlify/etc.) for production.
