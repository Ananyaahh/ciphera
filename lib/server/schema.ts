// lib/server/schema.ts
// Drizzle ORM schema for CIPHERA's shared backend. This file only
// *describes* the tables — it doesn't touch any existing app code.
// Existing local-storage/IndexedDB code in lib/auth.ts, lib/db.ts, and
// lib/ledger.ts stays untouched until a later step explicitly migrates it.

import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  timestamp,
  jsonb,
  doublePrecision,
  index,
} from "drizzle-orm/pg-core";

// ---------- Users ----------
// One row per CIPHERA identity. No private signing key ever lives here —
// only public key material, per device (see `devices` below).
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  identityToken: text("identity_token").notNull(),
  currentEpoch: integer("current_epoch").notNull().default(0),
  phone: text("phone"),
  googleSub: text("google_sub"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Devices ----------
// A user may enroll from multiple physical devices. Each device holds its
// own non-extractable signing keypair (private key never leaves that
// device); only the PUBLIC half is ever sent to the backend.
export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  publicKeyJwk: jsonb("public_key_jwk").notNull(),
  webauthnCredentialId: text("webauthn_credential_id"),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdIdx: index("devices_user_id_idx").on(t.userId),
}));

// ---------- Key epochs (§3.2 revocation without breaking non-repudiation) ----------
export const keyEpochs = pgTable("key_epochs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  epochNumber: integer("epoch_number").notNull(),
  helperData: text("helper_data").notNull(),
  status: text("status", { enum: ["active", "revoked"] }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => ({
  userEpochIdx: index("key_epochs_user_epoch_idx").on(t.userId, t.epochNumber),
}));

// ---------- Provenance ledger (§Layer 4) ----------
// Hash-chained, append-only.
export const ledgerRecords = pgTable("ledger_records", {
  index: integer("index").primaryKey(),
  type: text("type", { enum: ["capture", "revocation"] }).notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
  payloadHash: text("payload_hash").notNull(),
  signature: text("signature").notNull(),
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
}, (t) => ({
  payloadHashIdx: index("ledger_payload_hash_idx").on(t.payloadHash),
}));

// ---------- Captures (§Layer 3 metadata) ----------
// Metadata only — the watermarked image bytes themselves live elsewhere
// (a later step). imageHash is what verification checks against.
export const captures = pgTable("captures", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
  ledgerIndex: integer("ledger_index").notNull().references(() => ledgerRecords.index),
  epochNumber: integer("epoch_number").notNull(),
  imageHash: text("image_hash").notNull(),
  fragileHash: text("fragile_hash").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  geoLat: doublePrecision("geo_lat"),
  geoLng: doublePrecision("geo_lng"),
  geoAccuracy: doublePrecision("geo_accuracy"),
  geoCapturedAt: timestamp("geo_captured_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdIdx: index("captures_user_id_idx").on(t.userId),
  imageHashIdx: index("captures_image_hash_idx").on(t.imageHash),
}));