// lib/auth.ts
// Client-side simulation of the account/enrollment backend described in
// the architecture. In production this moves server-side: password
// hashing, OTP delivery, epoch bookkeeping, and the "helper data" store
// would all live behind an API, not in localStorage. This is a working
// demo of the *flow*, not a hardened auth service.

import { hashPassword, randomHex, randomId, sha256Hex, deriveIdentityToken } from "./crypto";
import { appendRecord } from "./ledger";
import type { CipheraUser, KeyEpoch, CaptureSessionWindow } from "./types";

const USERS_KEY = "ciphera:users:v1";
const EPOCHS_KEY = "ciphera:epochs:v1";
const SESSION_KEY = "ciphera:session:v1";
const OTP_KEY = "ciphera:otp:v1";
const WINDOW_KEY = "ciphera:capturewindow:v1";

export const SESSION_WINDOW_MS = 90_000; // §3.1 bounded window
export const SESSION_WINDOW_MAX_FRAMES = 20;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}
function writeJson(key: string, val: unknown) {
  window.localStorage.setItem(key, JSON.stringify(val));
}

// ---------- Users ----------

export function getUsers(): CipheraUser[] {
  return readJson<CipheraUser[]>(USERS_KEY, []);
}
export function getUserByUsername(username: string): CipheraUser | undefined {
  return getUsers().find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
}
export function getUserById(id: string): CipheraUser | undefined {
  return getUsers().find((u) => u.id === id);
}
function saveUser(user: CipheraUser) {
  const users = getUsers().filter((u) => u.id !== user.id);
  users.push(user);
  writeJson(USERS_KEY, users);
}

export async function createAccount(
  username: string,
  password: string
): Promise<CipheraUser> {
  const { hash, salt } = await hashPassword(password);
  // identityToken needs a real id to derive from — but the backend now
  // generates the id. We derive the token AFTER the backend responds.
  const tempId = randomId();
  const identityToken = await deriveIdentityToken(tempId);

  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      passwordHash: hash,
      passwordSalt: salt,
      identityToken,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? "Could not create account.");
  }

  const user: CipheraUser = {
    id: data.user.id,
    username: data.user.username,
    passwordHash: data.user.passwordHash,
    passwordSalt: data.user.passwordSalt,
    createdAt: new Date(data.user.createdAt).getTime(),
    currentEpoch: data.user.currentEpoch,
    identityToken: data.user.identityToken,
  };

  // Still cache locally too, for now — nothing that reads users.ts yet
  // knows how to fetch from the backend, so this keeps login/gallery/etc.
  // working exactly as before until Step 7 migrates the read side.
  saveUser(user);
  await createEpoch(user.id, 0);
  return user;
}

export async function verifyPassword(
  user: CipheraUser,
  password: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, user.passwordSalt);
  return hash === user.passwordHash;
}

export function attachCredential(userId: string, credentialId: string) {
  const user = getUserById(userId);
  if (!user) throw new Error("Unknown user.");
  user.webauthnCredentialId = credentialId;
  saveUser(user);
}

export function attachPublicKey(userId: string, jwk: JsonWebKey) {
  const user = getUserById(userId);
  if (!user) throw new Error("Unknown user.");
  user.publicKeyJwk = jwk;
  saveUser(user);
}

export function attachPhone(userId: string, phone: string) {
  const user = getUserById(userId);
  if (!user) throw new Error("Unknown user.");
  user.phone = phone;
  saveUser(user);
}

function getUserByGoogleSub(sub: string): CipheraUser | undefined {
  return getUsers().find((u) => u.googleSub === sub);
}

/**
 * Create-or-load a local Ciphera user for a Google identity that the server
 * has already verified. We never trust the browser's word for who the Google
 * user is -- callers must pass values returned by /api/auth/google.
 */
export async function upsertGoogleUser(profile: {
  googleSub: string;
  email: string;
  name: string;
}): Promise<CipheraUser> {
  const existing =
    getUserByGoogleSub(profile.googleSub) ??
    // fall back to matching an email-derived username from a prior Google enroll
    getUsers().find((u) => u.googleSub == null && u.username === profile.email);
  if (existing) {
    if (!existing.googleSub) {
      existing.googleSub = profile.googleSub;
      saveUser(existing);
    }
    return existing;
  }

  const id = randomId();
  const identityToken = await deriveIdentityToken(id);
  // Federated accounts have no local password; store an unusable random hash
  // so the shape of CipheraUser stays intact and password sign-in can't match.
  const user: CipheraUser = {
    id,
    username: profile.email,
    passwordHash: randomHex(32),
    passwordSalt: randomHex(16),
    createdAt: Date.now(),
    currentEpoch: 0,
    identityToken,
    googleSub: profile.googleSub,
  };
  saveUser(user);
  await createEpoch(id, 0);
  return user;
}

// ---------- Session ----------

export function setSession(userId: string) {
  window.localStorage.setItem(SESSION_KEY, userId);
}
export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}
export function getSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_KEY);
}
export function getCurrentUser(): CipheraUser | null {
  const id = getSessionUserId();
  if (!id) return null;
  return getUserById(id) ?? null;
}

// ---------- OTP (demo: generated + shown in-app, not actually sent) ----------

interface OtpRecord {
  username: string;
  code: string;
  expiresAt: number;
}

export function issueOtp(username: string): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const record: OtpRecord = { username, code, expiresAt: Date.now() + 5 * 60_000 };
  writeJson(OTP_KEY, record);
  return code;
}

export function verifyOtp(username: string, code: string): boolean {
  const record = readJson<OtpRecord | null>(OTP_KEY, null);
  if (!record) return false;
  if (record.username.toLowerCase() !== username.toLowerCase()) return false;
  if (Date.now() > record.expiresAt) return false;
  return record.code === code;
}

// ---------- Key epochs (§3.2 revocation without breaking non-repudiation) ----------

export function getEpochs(): KeyEpoch[] {
  return readJson<KeyEpoch[]>(EPOCHS_KEY, []);
}
export function getEpochsForUser(userId: string): KeyEpoch[] {
  return getEpochs()
    .filter((e) => e.userId === userId)
    .sort((a, b) => a.epochNumber - b.epochNumber);
}
export function getEpoch(userId: string, epochNumber: number): KeyEpoch | undefined {
  return getEpochs().find(
    (e) => e.userId === userId && e.epochNumber === epochNumber
  );
}
export function getActiveEpoch(userId: string): KeyEpoch | undefined {
  return getEpochs().find((e) => e.userId === userId && e.status === "active");
}

async function createEpoch(userId: string, epochNumber: number): Promise<KeyEpoch> {
  const epoch: KeyEpoch = {
    id: `${userId}:${epochNumber}`,
    userId,
    epochNumber,
    createdAt: Date.now(),
    revokedAt: null,
    helperData: randomHex(32), // public, non-secret fuzzy-extractor helper data analogue
    status: "active",
  };
  const all = getEpochs();
  all.push(epoch);
  writeJson(EPOCHS_KEY, all);
  return epoch;
}

/** Revokes the current epoch and opens a new one, per §3.2: the old epoch
 *  (and its helper data) is retained forever so images captured under it
 *  stay independently verifiable -- revocation only closes it to *future*
 *  captures. The revocation event itself is anchored to the ledger. */
export async function revokeAndRotateEpoch(
  userId: string,
  signRevocation: (payloadHash: string) => Promise<string>
): Promise<KeyEpoch> {
  const user = getUserById(userId);
  if (!user) throw new Error("Unknown user.");
  const current = getActiveEpoch(userId);
  const all = getEpochs();
  if (current) {
    current.status = "revoked";
    current.revokedAt = Date.now();
    writeJson(
      EPOCHS_KEY,
      all.map((e) => (e.id === current.id ? current : e))
    );
  }
  const nextEpochNumber = (current?.epochNumber ?? -1) + 1;
  const newEpoch = await createEpoch(userId, nextEpochNumber);

  user.currentEpoch = nextEpochNumber;
  saveUser(user);

  const revocationPayload = JSON.stringify({
    userId,
    revokedEpoch: current?.epochNumber ?? null,
    newEpoch: nextEpochNumber,
    at: Date.now(),
  });
  const payloadHash = await sha256Hex(revocationPayload);
  const signature = await signRevocation(payloadHash);
  await appendRecord("revocation", payloadHash, signature);

  return newEpoch;
}

// ---------- Session-liveness capture window (§3.1) ----------

export function getCaptureWindow(userId: string): CaptureSessionWindow | null {
  const w = readJson<CaptureSessionWindow | null>(WINDOW_KEY, null);
  if (!w || w.userId !== userId) return null;
  if (Date.now() > w.expiresAt || w.framesUsed >= w.maxFrames) return null;
  return w;
}

export function openCaptureWindow(
  userId: string,
  epochNumber: number
): CaptureSessionWindow {
  const w: CaptureSessionWindow = {
    userId,
    openedAt: Date.now(),
    expiresAt: Date.now() + SESSION_WINDOW_MS,
    framesUsed: 0,
    maxFrames: SESSION_WINDOW_MAX_FRAMES,
    epochNumber,
  };
  writeJson(WINDOW_KEY, w);
  return w;
}

export function consumeCaptureFrame(userId: string): CaptureSessionWindow | null {
  const w = getCaptureWindow(userId);
  if (!w) return null;
  w.framesUsed += 1;
  writeJson(WINDOW_KEY, w);
  return w;
}

export function closeCaptureWindow() {
  window.localStorage.removeItem(WINDOW_KEY);
}
