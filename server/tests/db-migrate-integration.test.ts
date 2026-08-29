import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { verifyRequiredTables } from "../db-migrate";

const schemaName = `migration_guard_${randomUUID().replaceAll("-", "")}`;
const quotedSchemaName = `"${schemaName}"`;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

describe("participant migration startup guard", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query(`CREATE SCHEMA ${quotedSchemaName}`);
    await client.query(`
      CREATE TABLE ${quotedSchemaName}.participants (
        id varchar PRIMARY KEY,
        competencies jsonb NOT NULL DEFAULT '[]'::jsonb,
        evidences jsonb NOT NULL DEFAULT '[]'::jsonb,
        learning_history jsonb NOT NULL DEFAULT '[]'::jsonb
      );
      CREATE TABLE ${quotedSchemaName}.participant_competencies (id varchar PRIMARY KEY);
      CREATE TABLE ${quotedSchemaName}.evidences (id varchar PRIMARY KEY);
      CREATE TABLE ${quotedSchemaName}.learning_records (id varchar PRIMARY KEY);
      INSERT INTO ${quotedSchemaName}.participants
        (id, competencies, evidences, learning_history)
      VALUES
        (
          'legacy-participant',
          '[{"unitId":"smap-01","currentLevel":"L1","targetLevel":"L2"}]',
          '[{"id":"legacy-evidence","unitId":"smap-01"}]',
          '[{"id":"legacy-record","courseId":"course-smap01-l2"}]'
        );
    `);
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS ${quotedSchemaName} CASCADE`);
    await client.end();
  });

  it("rejects existing destination tables when legacy JSONB data was not migrated", async () => {
    await expect(verifyRequiredTables({ schemaName })).rejects.toThrow(
      "Participant data migration is incomplete",
    );
  });
});