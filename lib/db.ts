// lib/db.ts
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../drizzle/schema";

loadEnvConfig(process.cwd());

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/nextsync";

const isNeon = databaseUrl.includes("neon.tech");
// Neon HTTP driver uses fetch() — fails TLS cert verification on some Windows setups.
// Use pg Pool locally; keep neon-http on Vercel where fetch TLS works reliably.
const useNeonHttp = isNeon && process.env.VERCEL === "1";

function createPgPool() {
  return new Pool({
    connectionString: databaseUrl,
    ssl: isNeon ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });
}

export const db = useNeonHttp
  ? drizzleNeon(neon(databaseUrl), { schema })
  : drizzlePg(createPgPool(), { schema });

export type DbClient = typeof db;
export * from "../drizzle/schema";
