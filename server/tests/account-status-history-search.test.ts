import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accountStatusHistoryQuerySchema } from "@shared/schema";
import { buildHistoryQuery, literalSubstringPattern, type HistoryQuery } from "../account-status-history-query";
import { searchMigration, seedHistoryBenchmark } from "../../script/history-benchmark-fixture";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const database = drizzle(client);
const parse = (input: Record<string, string> = {}) => accountStatusHistoryQuerySchema.parse(input);

// Independent oracle: the original strpos predicate, with the same timezone
// boundaries, stable ordering, offset and limit+1 used by the HTTP endpoint.
async function original(input: HistoryQuery) {
  return (await client.query(`
    SELECT * FROM account_status_history
    WHERE ($1::text IS NULL OR actor_id = $1 OR strpos(lower(actor_username), lower($1)) > 0)
      AND ($2::text IS NULL OR target_user_id = $2 OR strpos(lower(target_username), lower($2)) > 0)
      AND ($3::timestamptz IS NULL OR changed_at >= $3)
      AND ($4::timestamptz IS NULL OR changed_at < $4)
    ORDER BY changed_at DESC, id DESC LIMIT $5 OFFSET $6`, [
    input.actor || null, input.target || null,
    input.from ? new Date(`${input.from}T00:00:00+07:00`) : null,
    input.to ? new Date(new Date(`${input.to}T00:00:00+07:00`).getTime() + 86400000) : null,
    input.limit + 1, input.offset,
  ])).rows;
}

beforeAll(async () => {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = '20s'");
  await seedHistoryBenchmark(client, 100_000);
  await client.query(await searchMigration());
  // Idempotent migration on a populated table.
  await client.query(await searchMigration());
  await client.query(`INSERT INTO account_status_history
    (id, actor_id, actor_username, target_user_id, target_username,
     previous_is_active, new_is_active, changed_at)
    SELECT 'literal-' || i, 'removed-actor', E'A_Imut%\\\\Nama.É漢字',
      'removed-target', E'Z_%\\\\Nama.É漢字', true, false, value::timestamptz
    FROM unnest(ARRAY[
      '2030-03-09 16:59:59.999+00', '2030-03-09 17:00:00+00',
      '2030-03-10 08:00:00+00', '2030-03-10 08:00:00+00',
      '2030-03-10 16:59:59.999+00', '2030-03-10 17:00:00+00'
    ]) WITH ORDINALITY AS dates(value, i)`);
  await client.query("ANALYZE account_status_history");
}, 60_000);

afterAll(async () => {
  await client.query("ROLLBACK").catch(() => {});
  await client.end();
});

describe("indexed immutable audit identity search", () => {
  it("escapes every LIKE metacharacter, including adjacent escapes", () => {
    expect(literalSubstringPattern("A%_\\B")).toBe("%A\\%\\_\\\\B%");
  });

  it.each([
    {}, { actor: "min.007" }, { target: "sErTa.01999" },
    { actor: "10000000-0000-4000-8000-000000000007" }, { target: "20000000-0000-4000-8000-000000001999" },
    { actor: "10000000-0000-4000-8000-000000000007", target: "peserta.00207", from: "2023-01-01", to: "2023-12-31" },
    { actor: "min.007", target: "peserta.0", from: "2023-01-01", to: "2027-01-01" },
    { target: "Deleted_%_\\", from: "2023-01-01", to: "2027-01-01" },
    { actor: "absent-identity" }, { target: "ta" },
    { actor: "a" }, { actor: "ad" }, { actor: "007" },
    { from: "2023-02-01", to: "2023-02-20" },
    { actor: "%" }, { target: "_" }, { target: "\\" }, { target: "%_\\" },
    { actor: "é漢字", target: "É漢" }, { actor: "mut%\\Nama" }, { target: "Z_%\\Nama" }, { target: "ZXYNama" },
    { actor: "' OR 1=1 --" }, { actor: "removed-actor", target: "removed-target" },
  ])("matches original literal substring results at shallow and deep offsets: %j", async filters => {
    for (const offset of ["0", "50", "500", "5000", "75000", "2147483647"]) {
      const input = parse({ ...filters, offset, limit: "7" });
      const entries = await buildHistoryQuery(database, input);
      const reference = await original(input);
      expect(entries.map(row => row.id)).toEqual(reference.map(row => row.id));
      expect(entries.length > input.limit).toBe(reference.length > input.limit);
    }
  });

  it("paginates deleted-account snapshots across equal timestamps and WIB boundaries without gaps", async () => {
    const filters = { actor: "removed-actor", target: "é漢字", from: "2030-03-10", to: "2030-03-10", limit: "2" };
    const first = await buildHistoryQuery(database, parse(filters));
    const second = await buildHistoryQuery(database, parse({ ...filters, offset: "2" }));
    expect(first.map(row => row.id)).toEqual(["literal-5", "literal-4", "literal-3"]);
    expect(second.map(row => row.id)).toEqual(["literal-3", "literal-2"]);
    expect(first[0]).toMatchObject({
      actorId: "removed-actor", actorUsername: "A_Imut%\\Nama.É漢字",
      targetUserId: "removed-target", targetUsername: "Z_%\\Nama.É漢字", reason: null,
    });
  });

  it("uses both indexed identity branches for selective searches without forcing planner settings", async () => {
    for (const filters of [
      { actor: "min.007", offset: "5000" }, { actor: "absent-identity", offset: "0" },
      { target: "sErTa.01999", offset: "0" }, { target: "20000000-0000-4000-8000-000000001999", offset: "5000" },
    ]) {
      const query = buildHistoryQuery(database, parse(filters)).toSQL();
      const { rows } = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.sql}`, query.params);
      const plan = JSON.stringify(rows);
      const identity = filters.actor ? "actor" : "target";
      expect(plan).toContain(`account_status_history_${identity}_name_trgm_idx`);
      expect(plan).toContain(`account_status_history_${identity}_id_time_idx`);
      expect(plan).toContain("BitmapOr");
      expect(plan).not.toContain('"Node Type":"Seq Scan"');
    }
  });

  it("collects expression statistics for this table rather than changing the real audit table", async () => {
    const { rows } = await client.query(`SELECT count(*)::int AS count FROM pg_statistic_ext
      WHERE stxrelid = 'pg_temp.account_status_history'::regclass
        AND stxname IN ('account_status_history_actor_search_stats', 'account_status_history_target_search_stats')`);
    expect(rows[0].count).toBe(2);
  });

  it("keeps non-trigram searches off the full GIN scan path on deep pages", async () => {
    for (const target of ["ta", "%_\\", "é漢"]) {
      const query = buildHistoryQuery(database, parse({ target, offset: "75000" })).toSQL();
      expect(query.sql).toContain("strpos(");
      const { rows } = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.sql}`, query.params);
      expect(JSON.stringify(rows)).not.toContain("name_trgm_idx");
    }
  });
});
