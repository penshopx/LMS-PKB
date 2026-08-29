import { beforeEach, describe, expect, it, vi } from "vitest";

const pgMocks = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
}));

vi.mock("pg", () => ({
  default: {
    Client: class {
      connect = pgMocks.connect;
      query = pgMocks.query;
      end = pgMocks.end;
    },
  },
}));

process.env.DATABASE_URL ??= "postgresql://test.invalid/database";

import { verifyRequiredTables } from "../db-migrate";

describe("verifyRequiredTables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pgMocks.connect.mockResolvedValue(undefined);
    pgMocks.end.mockResolvedValue(undefined);
  });

  it("fails startup with an actionable error listing every missing table", async () => {
    pgMocks.query.mockResolvedValue({
      rows: [{ table_name: "evidences" }],
    });

    await expect(verifyRequiredTables()).rejects.toThrow(
      "Required database table(s) are missing: participant_competencies, learning_records. " +
      "Run `npm run db:push` or apply the database migrations before starting the server.",
    );
    expect(pgMocks.end).toHaveBeenCalledOnce();
  });

  it("allows startup when all participant relation tables exist", async () => {
    pgMocks.query.mockResolvedValueOnce({
      rows: [
        { table_name: "participant_competencies" },
        { table_name: "evidences" },
        { table_name: "learning_records" },
      ],
    }).mockResolvedValueOnce({ rows: [] });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(verifyRequiredTables()).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[db-check] Required participant relation tables present: " +
      "participant_competencies, evidences, learning_records",
    );
    expect(pgMocks.end).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });
});