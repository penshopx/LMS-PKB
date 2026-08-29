/**
 * Minimal SQL migration runner.
 *
 * Tracks applied migrations in a `_migrations` table.
 * Each migration file is a plain SQL script; scripts are run inside a single
 * client transaction so failures leave the database unchanged.
 *
 * Usage:
 *   import { runMigrations } from "./db-migrate";
 *   await runMigrations();
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// __dirname is not available in ESM; derive it from import.meta.url instead.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

export async function runMigrations(): Promise<void> {
  // Use a dedicated client (not the pool) so we control the transaction ourselves.
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // Ensure tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id          SERIAL PRIMARY KEY,
        filename    text NOT NULL UNIQUE,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.log("[db-migrate] No migrations directory found, skipping.");
      return;
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith(".sql"))
      .sort();

    for (const filename of files) {
      const { rows } = await client.query(
        "SELECT 1 FROM _migrations WHERE filename = $1",
        [filename],
      );

      if (rows.length > 0) {
        continue; // already applied
      }

      const filepath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filepath, "utf-8");

      console.log(`[db-migrate] Applying migration: ${filename}`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO _migrations (filename) VALUES ($1)",
          [filename],
        );
        await client.query("COMMIT");
        console.log(`[db-migrate] Applied: ${filename}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${filename} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
}
