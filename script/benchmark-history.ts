import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { accountStatusHistory, accountStatusHistoryQuerySchema } from "../shared/schema";
import { buildHistoryQuery, historyFilter, type HistoryQuery } from "../server/account-status-history-query";
import { searchMigration, seedHistoryBenchmark } from "./history-benchmark-fixture";

const rows = Number(process.argv[2] ?? 1_000_000);
if (!Number.isInteger(rows) || rows < 100_000 || rows > 5_000_000) {
  throw new Error("Specify 100000–5000000 synthetic audit rows.");
}
const scenarios = [
  { name: "actor-substring", actor: "min.007" },
  { name: "target-substring", target: "sErTa.01999" },
  { name: "both-identities-dates", actor: "min.007", target: "peserta.00207", from: "2023-01-01", to: "2027-01-01" },
  { name: "both-identities-dates-many", actor: "min.007", target: "peserta.0", from: "2023-01-01", to: "2027-01-01" },
  { name: "both-identities-narrow-dates", actor: "min.007", target: "peserta.0", from: "2023-06-01", to: "2023-07-01" },
  { name: "literal-deleted-dates", target: "%_\\", from: "2023-01-01", to: "2027-01-01" },
  { name: "exact-target-id", target: "20000000-0000-4000-8000-000000001999" },
  { name: "no-match", actor: "absent-identity" },
  { name: "short-substring", target: "ta" },
  { name: "date-only", from: "2023-06-01", to: "2023-12-31" },
  { name: "unfiltered" },
].flatMap(scenario => [0, 500, 5000, 100000].map(offset => ({
  name: `${scenario.name}/offset-${offset}`,
  input: accountStatusHistoryQuerySchema.parse({ ...Object.fromEntries(
    Object.entries(scenario).filter(([key]) => key !== "name"),
  ), offset: String(offset) }),
})));

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = '120s'");
  await seedHistoryBenchmark(client, rows);
  const database = drizzle(client);
  const legacyQuery = (input: HistoryQuery) => database.select().from(accountStatusHistory)
    .where(and(
      historyFilter({ ...input, actor: undefined, target: undefined }),
      input.actor ? or(eq(accountStatusHistory.actorId, input.actor),
        sql`strpos(lower(${accountStatusHistory.actorUsername}), lower(${input.actor})) > 0`) : undefined,
      input.target ? or(eq(accountStatusHistory.targetUserId, input.target),
        sql`strpos(lower(${accountStatusHistory.targetUsername}), lower(${input.target})) > 0`) : undefined,
    )).orderBy(desc(accountStatusHistory.changedAt), desc(accountStatusHistory.id))
    .limit(input.limit + 1).offset(input.offset);
  const results: Record<string, unknown>[] = [];
  const expected = new Map<string, string[]>();
  for (const phase of ["chronology-only-strpos", "indexed-hybrid-literal"]) {
    if (phase === "indexed-hybrid-literal") {
      const start = performance.now();
      await client.query(await searchMigration());
      await client.query("ANALYZE account_status_history");
      console.log(`Index build + analyze: ${((performance.now() - start) / 1000).toFixed(2)}s`);
    }
    for (const { name, input } of scenarios) {
      const query = (phase === "chronology-only-strpos" ? legacyQuery(input) : buildHistoryQuery(database, input)).toSQL();
      const ids = (await client.query(query.sql, query.params)).rows.map(row => row.id as string);
      if (phase === "chronology-only-strpos") expected.set(name, ids);
      else if (JSON.stringify(ids) !== JSON.stringify(expected.get(name))) {
        throw new Error(`Result/ordering mismatch for ${name}`);
      }
      const plans = [];
      for (let repeat = 0; repeat < 3; repeat++) {
        const result = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.sql}`, query.params);
        plans.push(result.rows[0]["QUERY PLAN"][0]);
      }
      const times = plans.map(plan => plan["Execution Time"]).sort((a, b) => a - b);
      const medianMs = times[1];
      results.push({ phase, name, returned: ids.length, medianMs, plans });
      console.log(`${phase} ${name}: ${medianMs.toFixed(2)}ms (${ids.length} rows)`);
    }
  }
  const size = (await client.query(`SELECT indexrelname, pg_relation_size(indexrelid)::bigint AS bytes
    FROM pg_stat_all_indexes WHERE relid = 'pg_temp.account_status_history'::regclass`)).rows;
  const tableBytes = (await client.query(`SELECT pg_relation_size('pg_temp.account_status_history')::bigint AS bytes`)).rows[0].bytes;
  await mkdir("generated-artifacts/history-benchmark", { recursive: true });
  await writeFile(`generated-artifacts/history-benchmark/${rows}.json`,
    JSON.stringify({ rows, repetitions: 3, version: (await client.query("SELECT version()")).rows[0].version, tableBytes, size, results }, null, 2));
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end();
}
