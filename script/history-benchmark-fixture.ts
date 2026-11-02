import type pg from "pg";
import { readFile } from "node:fs/promises";

export const searchMigration = () =>
  readFile(new URL("../server/migrations/022_account_status_history_search.sql", import.meta.url), "utf8");

// Connection-local shadow table: never insert fixtures in the real audit trail.
// No live user rows exist for these identities, intentionally.
export async function seedHistoryBenchmark(client: pg.Client, rows: number) {
  await client.query(`CREATE TEMP TABLE account_status_history
    (LIKE public.account_status_history INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP`);
  await client.query(`CREATE UNIQUE INDEX history_fixture_pk ON account_status_history (id)`);
  await client.query(`CREATE INDEX account_status_history_chronology_idx ON account_status_history (changed_at, id)`);
  await client.query(`
    INSERT INTO account_status_history
      (id, actor_id, actor_username, target_user_id, target_username,
       previous_is_active, new_is_active, reason, changed_at)
    SELECT '00000000-0000-4000-8000-' || lpad(i::text, 12, '0'),
      '10000000-0000-4000-8000-' || lpad((i % 200)::text, 12, '0'),
      'Admin.' || lpad((i % 200)::text, 3, '0'),
      '20000000-0000-4000-8000-' || lpad((i % 20000)::text, 12, '0'),
      CASE WHEN i % 997 = 0 THEN E'Deleted_%_\\\\Pegawai'
           ELSE 'Peserta.' || lpad((i % 20000)::text, 5, '0') END,
      i % 2 = 0, i % 2 <> 0,
      CASE WHEN i % 10 = 0 THEN NULL
           ELSE repeat('Penyesuaian akses operasional BUJK. ', 3) END,
      timestamptz '2023-01-01 00:00:00+07' + (i / 3) * interval '5 minutes'
    FROM generate_series(1, $1::integer) AS n(i)`, [rows]);
  await client.query("ANALYZE account_status_history");
}
