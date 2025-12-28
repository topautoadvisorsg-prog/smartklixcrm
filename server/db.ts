import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️  DATABASE_URL not set - using placeholder mode");
}

const pool = connectionString ? new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
}) : null;

export const db = pool ? drizzle(pool, { schema }) : null;

export function isDatabaseConnected(): boolean {
  return db !== null && connectionString !== undefined && connectionString !== "__SET_AT_DEPLOY__";
}
