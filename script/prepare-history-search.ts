// Development setup prerequisite for drizzle-kit push: operator classes must
// exist before Drizzle can create the expression indexes. Not a deploy hook.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
} finally {
  await client.end();
}
