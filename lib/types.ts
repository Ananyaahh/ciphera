// Shared domain types for Ciphera.
// These model the architecture: enrollment (Layer 1), capture-time auth
// (Layer 2), embedding (Layer 3), ledger anchoring (Layer 4), and
// verification (Layer 5).

export interface CipheraUser {
  id: string; // stable user id (uuid)
  username: string;
  passwordHash: string; // salted hash, demo-grade (see lib/crypto.ts)
  passwordSalt: string;
  createdAt: number;
  currentEpoch: number; // key-epoch versioning (§3.2)
  webauthnCredentialId?: string; // base64url credential id bound to this device
  identityToken: string; // short public token embedded in the robust watermark layer
  publicKeyJwk?: JsonWebKey; // exported public half of the device-bound signing key
  phone?: string; // E.164 phone bound to this account (for SMS OTP)
  googleSub?: string; // Google account subject id, if enrolled via "Continue with Google"
}

export interface KeyEpoch {
  id: string; // `${userId}:${epochNumber}`
  userId: string;
  epochNumber: number;
  createdAt: number;
  revokedAt: number | null;
  // "helper data" analogue: safe-to-store-publicly, non-secret material
  // that lets a verifier recompute a stable epoch key without ever
  // learning the underlying biometric.
  helperData: string;
  status: "active" | "revoked";
}

export interface CaptureSessionWindow {
  userId: string;
  openedAt: number;
  expiresAt: number; // opensAt + WINDOW_MS
  framesUsed: number;
  maxFrames: number;
  epochNumber: number;
}

export interface WatermarkPayload {
  identityToken: string; // who
  userId: string;
  epochNumber: number; // which key-epoch signed this
  imageId: string; // per-image id
  capturedAt: number; // when
  nonce: string; // per-capture random nonce (HKDF salt component)
  imageHash: string; 
  geo?: GeoTag | null;// sha-256 of the raw pixel buffer at capture time
}

export interface GeoTag {
  lat: number;
  lng: number;
  accuracy?: number;
  capturedAt: number;
}
export interface LedgerRecord {
  index: number;
  type: "capture" | "revocation";
  payloadHash: string; // hash of the WatermarkPayload (or revocation record)
  signature: string; // ECDSA signature over payloadHash, device-bound key
  prevHash: string; // hash-chains this record to the previous one
  hash: string; // hash of this record (index+type+payloadHash+sig+prevHash)
  timestamp: number;
}

export interface CipheraImage {
  id: string;
  userId: string;
  createdAt: number;
  width: number;
  height: number;
  blob: Blob; // watermarked PNG stored in IndexedDB (must stay lossless -- see README)
  thumbnail: string; // small data URL for fast gallery rendering
  payload: WatermarkPayload;
  ledgerIndex: number;
  fragileHash: string; // hash embedded in the fragile layer at capture time
}

export type VerificationStatus = "verified" | "tampered" | "unverifiable";

export interface VerificationResult {
  status: VerificationStatus;
  identityToken: string | null;
  username: string | null;
  capturedAt: number | null;
  epochNumber: number | null;
  epochStatus: "active" | "revoked" | null;
  ledgerMatch: boolean;
  fragileIntact: boolean;
  details: string;
}
