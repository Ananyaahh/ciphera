// lib/server/db.ts
// Single shared connection to the Neon Postgres backend. Every API route
// imports `db` from here instead of opening its own connection. This is
// the ONLY new thing that talks to Postgres — nothing in the existing
// lib/db.ts (IndexedDB), lib/auth.ts, or lib/ledger.ts is touched by this
// file or anything it imports.

import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
