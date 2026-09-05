// drizzle.config.ts
import "dotenv/config";
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/server/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
