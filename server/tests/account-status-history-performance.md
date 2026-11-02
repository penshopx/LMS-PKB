# Audit identity search benchmark

## Reproduce

```sh
npm run benchmark:history -- 100000
npm run benchmark:history -- 1000000
npx vitest run server/tests/account-status-history-search.test.ts server/tests/account-status.test.ts server/tests/account-status-ui.test.ts
```

Use the development database, never a production connection. No real audit rows
are inserted, updated, or deleted. The benchmark uses a connection-local temporary
table with the real column types, defaults, and constraints. All fixture objects
(including statistics) are isolated and rolled back on completion or failure.
Requires the same permission to install `pg_trgm` as application setup; a missing
permission fails explicitly, rather than silently omitting the indexes.

Full `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plans, three measurements per query,
median execution times, result counts, PostgreSQL version, and relation/index sizes
are written to `generated-artifacts/history-benchmark/<rows>.json` (git/deployment
ignored). These are generated diagnostics, not application assets.

## Workload and interpretation

- PostgreSQL 16.10, existing development database settings; planner methods are
  **not** forced off. Analyze the table before each phase.
- 100,000 and 1,000,000 events, UUID-width event/actor/target identifiers, 200
  administrators and 20,000 participants. Repeated identities, mixed-case names,
  deleted-account snapshots containing literal `%`, `_`, and `\`, 10% legacy
  null reasons, ordinary 105-character reasons, three identical timestamps per
  five-minute interval. No corresponding live users are needed.
- A million rows span about 3.2 years from January 2023; 100,000 span about four
  months. The June–July narrow-date case is intentionally empty at 100,000 rows
  and populated at a million: do not compare that case as equal result workloads.
- Eleven query families, each with offsets 0, 500, 5,000 and 100,000: actor name,
  target name, both identities plus broad dates (rare and common intersections),
  both identities plus narrow dates, punctuation-only deleted identity plus
  dates, exact account ID, missing identity, two-character term, date-only, and
  unfiltered. Limit is 50, fetching 51 to detect `hasMore`.
- Both **populated** later pages and pages past the final match are covered.
  For example, at a million rows offset 500 still returns 51 actor matches and
  51 matches for the common identity/date intersection. Broad searches still
  return 51 rows at offset 100,000.
- Baseline: original `strpos(lower(snapshot), lower(parameter))`, ID equality OR
  substring, chronology index only. Optimized: the production query builder,
  escaped literal LIKE when there is an ASCII trigram, original `strpos` otherwise,
  both GIN expression indexes, both ID/time indexes, and identity statistics.
- Each query is executed before timing; every returned ID **in order**, including
  the extra `hasMore` row, must match the baseline or the command fails.
  Reported times are median database execution milliseconds, not HTTP latency
  or a cold-disk/concurrent-throughput guarantee.
- Temp relation blocks appear under **Local** buffer counters, not Shared.
  This fixture measures read plans, not WAL durability or GIN maintenance during
  concurrent writes. Timing is descriptive; automated tests assert semantic
  equivalence and index/plan properties rather than fragile wall-clock limits.

## Why the optimization has multiple parts

`strpos` cannot use a trigram index. Escaped LIKE on PostgreSQL-lowercased strings
preserves literal, case-insensitive substring matching, including consecutive
backslashes and wildcard characters. Both OR branches need indexes: a username
GIN index alone cannot make `exact ID OR username substring` indexable.

GIN alone was still insufficient. Without expression statistics PostgreSQL
sometimes estimated thousands of matches and chose a chronological scan to fill
the first page. With fewer than 51 actual matches, it scanned all million rows.
Expression statistics on the lowercase snapshots and more detailed actor-ID
statistics improve that estimate, especially for absent actors; the migration
collects statistics immediately, without waiting for autovacuum. Keep them when
maintaining these indexes. Estimates remain sample-dependent: in the recorded
million-row run the rare target's first page still chose a chronology scan,
whereas its deeper pages used the bitmap indexes. Do not treat statistics as a
guarantee that every selective first page will use GIN.

Do not replace every predicate with LIKE. A two-character or punctuation-only
search has no useful trigram; an exploratory all-LIKE run made the 100,000-offset
two-character case take about 1.45 seconds. The non-trigram path preserves the
original chronological scan instead. Unicode-only terms are conservatively kept
on that literal path too; semantics do not depend on JavaScript case conversion.

## Semantic and operational checks

`account-status-history-search.test.ts` uses 100,000 events and the actual migration,
applies the migration twice, compares against an independent original-SQL oracle
at offsets 0, 50, 500, 5,000, 75,000, and the maximum accepted offset. Coverage
includes ID lookup, case folding, literal metacharacters, Unicode, SQL-looking
strings, deleted snapshots, null reasons, date intersections, empty results,
equal-timestamp ID tie-breaking, and both exact WIB midnight boundaries.

Plan assertions cover selective and absent identities, including the first page
with fewer than 51 matches, both indexed OR branches, and avoidance of full GIN
scans for non-trigram terms. Existing HTTP tests continue to enforce admin-only
access (anonymous 401; participant/PIC 403), no-store responses, input validation,
snapshot output, and filtered `hasMore` pagination.

The migration stays in `server/migrations`, which the existing runner discovers
and the build copies into `dist/migrations`. Drizzle index definitions stay aligned
in `shared/schema.ts`. `npm run db:push` prepares the extension **before** creating
indexes; expression statistics and their ANALYZE are managed by the SQL migration,
because Drizzle does not declare PostgreSQL extended statistics.

Index creation uses the existing transactional migration runner and ordinary
CREATE INDEX, not concurrent creation. Initial construction on a very large
existing table can temporarily block writes; plan a maintenance window. This
benchmark does not claim to validate an online, zero-downtime index rollout.
Offset remains intentionally compatible with the current API: broad/punctuation
searches can still scan many rows, and skipping more matching rows still costs
more. No cursor contract, live-user join, role change, or response-field change
was introduced.

## Recorded results

Measured on 2026-11-02. Milliseconds, median of three EXPLAIN ANALYZE executions.
Every scenario's result IDs and order matched the original SQL at both sizes.
The final column shows optimized timing at 100,000 rows as a growth comparison.

| Query / offset | Original, 1M | Optimized, 1M | Optimized, 100K |
| --- | ---: | ---: | ---: |
| Actor substring / 0 | 3.33 | 26.39 | 1.90 |
| Actor substring / 500 (populated) | 41.10 | 25.09 | 1.65 |
| Actor substring / 5,000 (exhausted) | 393.76 | 24.89 | 1.68 |
| Target substring / 0 (50 matches) | 397.58 | 417.81 | 1.84 |
| Target substring / 100,000 (exhausted) | 405.31 | 19.48 | 2.29 |
| Both identities + broad dates / 0 | 392.54 | 47.86 | 2.63 |
| Both identities + broad dates / 500 (populated) | 91.38 | 26.07 | 1.83 |
| Both identities + narrow dates / 0 | 9.91 | 23.45 | 0.01 (empty) |
| Literal `%_\` + dates / 500 (populated at 1M) | 241.28 | 232.17 | 41.62 |
| Literal `%_\` + dates / 100,000 | 418.08 | 423.01 | 46.55 |
| Exact target ID / 0 | 386.97 | 0.22 | 0.11 |
| Missing actor / 0 | 345.25 | 0.03 | 0.03 |
| Two-character term / 100,000 (populated) | 54.90 | 52.88 | 55.18 (exhausted) |
| Date only / 100,000 | 26.02 | 27.02 | 0.01 (empty) |
| Unfiltered / 100,000 | 24.58 | 24.63 | 33.17 (exhausted) |

The point is not that every query becomes faster: common first pages and narrow
date ranges were already cheap, and the planner can trade those for bitmap scans.
The large improvements are exhausted selective pages, identity/date intersections,
exact IDs and absent actors. Punctuation-only literal searches remain linear and
the rare target's first-page plan above remains an observed limitation (about
0.42 seconds here, not an assertion of constant-time performance as history grows).
No minimum search length or changed match behavior is imposed to hide that limit.

At a million rows, selective later pages use `BitmapOr` over the ID/time and
lowercase-name GIN indexes, then bitmap heap scan and deterministic sort. In the
common identity/date intersection the actor bitmap selects about 5,000 candidates,
instead of evaluating a substring against every row. Missing-actor lookup touches
only a few index buffers. Non-trigram and broad pages retain a chronology scan.

The fixture heap occupies **270.4 MiB**. The four additional indexes together
occupy **258.1 MiB** (about 16.6/25.1 MiB for actor/target GIN and 108.2 MiB each
for the covering ID/time indexes). Construction plus ANALYZE took **13.72 seconds**
at a million rows and **2.30 seconds** at 100,000 rows. This storage/write cost
is explicit; read improvements do not imply free index maintenance.
