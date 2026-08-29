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
import pg from "pg";

const PARTICIPANT_RELATIONS_MIGRATION = "001_participant_relations.sql";

function resolveMigrationsDir(): string {
  const candidateDirectories = [
    ...(typeof __dirname !== "undefined"
      ? [path.join(__dirname, "migrations")]
      : []),
    path.join(process.cwd(), "server", "migrations"),
  ];

  return candidateDirectories.find((directory) =>
    fs.existsSync(path.join(directory, PARTICIPANT_RELATIONS_MIGRATION))
  ) ?? path.join(process.cwd(), "server", "migrations");
}

const MIGRATIONS_DIR = resolveMigrationsDir();

const REQUIRED_PARTICIPANT_RELATION_TABLES = [
  "participant_competencies",
  "evidences",
  "learning_records",
] as const;

const LEGACY_PARTICIPANT_COLUMNS = [
  "competencies",
  "evidences",
  "learning_history",
] as const;

/**
 * Verify the tables used by participant detail and learning flows exist.
 *
 * This check intentionally runs after migrations and before seeding/routes are
 * set up. A missing table must stop startup instead of making participant
 * reads appear to succeed with incomplete data or fail later with a 500.
 */
export async function verifyRequiredTables(
  { schemaName = "public" }: { schemaName?: string } = {},
): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows } = await client.query<{ table_name: string }>(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
          AND table_name = ANY($2::text[])
      `,
      [schemaName, REQUIRED_PARTICIPANT_RELATION_TABLES],
    );

    const existingTables = new Set(rows.map(({ table_name }) => table_name));
    const missingTables = REQUIRED_PARTICIPANT_RELATION_TABLES.filter(
      (tableName) => !existingTables.has(tableName),
    );

    if (missingTables.length > 0) {
      throw new Error(
        `Required database table(s) are missing: ${missingTables.join(", ")}. ` +
        "Run `npm run db:push` or apply the database migrations before starting the server.",
      );
    }

    const legacyColumnsResult = await client.query<{ column_name: string }>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = 'participants'
          AND column_name = ANY($2::text[])
      `,
      [schemaName, LEGACY_PARTICIPANT_COLUMNS],
    );
    const legacyColumns = legacyColumnsResult.rows.map(({ column_name }) => column_name);

    if (legacyColumns.length > 0) {
      throw new Error(
        `Participant data migration is incomplete. Legacy column(s) still exist on ${schemaName}.participants: ` +
        `${legacyColumns.join(", ")}. Apply ${PARTICIPANT_RELATIONS_MIGRATION} before starting the server ` +
        "so existing participant data is backfilled safely.",
      );
    }

    console.log(
      `[db-check] Required participant relation tables present: ${REQUIRED_PARTICIPANT_RELATION_TABLES.join(", ")}`,
    );
  } finally {
    await client.end();
  }
}

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
