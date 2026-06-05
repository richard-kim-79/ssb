import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // For migrations, prefer the DIRECT (non-pooled) connection if available.
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "",
  },
  verbose: true,
  strict: true,
});
