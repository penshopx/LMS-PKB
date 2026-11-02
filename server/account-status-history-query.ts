import { and, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import { accountStatusHistory, accountStatusHistoryQuerySchema } from "@shared/schema";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export type HistoryQuery = z.infer<typeof accountStatusHistoryQuerySchema>;

// LIKE has the same literal substring semantics as strpos only when all three
// metacharacters are escaped. Lower both operands in PostgreSQL, not JavaScript.
export function literalSubstringPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, character => `\\${character}`)}%`;
}

function usernameSubstring(column: AnyPgColumn, value: string) {
  // Without an extractable trigram GIN may scan the entire index, which is
  // slower than the original predicate on broad searches and deep pages.
  // ASCII is deliberately conservative; other scripts retain literal matching.
  return /[a-z0-9]{3}/i.test(value)
    ? sql`lower(${column}) LIKE lower(${literalSubstringPattern(value)}) ESCAPE E'\\\\'`
    : sql`strpos(lower(${column}), lower(${value})) > 0`;
}

export function historyFilter({ actor, target, from, to }: HistoryQuery) {
  return and(
    actor ? or(
      eq(accountStatusHistory.actorId, actor),
      usernameSubstring(accountStatusHistory.actorUsername, actor),
    ) : undefined,
    target ? or(
      eq(accountStatusHistory.targetUserId, target),
      usernameSubstring(accountStatusHistory.targetUsername, target),
    ) : undefined,
    from ? gte(accountStatusHistory.changedAt, new Date(`${from}T00:00:00+07:00`)) : undefined,
    // Inclusive WIB end date, expressed as an exclusive next-midnight bound.
    to ? lt(accountStatusHistory.changedAt, new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86400000)) : undefined,
  );
}

export function buildHistoryQuery<TSchema extends Record<string, unknown>>(database: NodePgDatabase<TSchema>, input: HistoryQuery) {
  // Never join live users: immutable snapshots also represent deleted accounts.
  return database.select().from(accountStatusHistory)
    .where(historyFilter(input))
    .orderBy(desc(accountStatusHistory.changedAt), desc(accountStatusHistory.id))
    .limit(input.limit + 1).offset(input.offset);
}
