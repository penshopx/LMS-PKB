---
name: Audit substring search performance
description: Why audit identity search keeps a non-trigram path and how to compare performance safely.
---

Keep literal substring semantics when optimizing historical identity searches.
Do not assume every literal can benefit from a trigram index: short terms and
punctuation-only terms need the original non-trigram predicate.

**Why:** A million-row measurement found that using indexed LIKE for a two-letter
term could turn a deep page into a full GIN scan and make it substantially slower
than the existing chronological search. An index alone is not proof of improvement.

Expression statistics matter as much as indexes when a LIMIT is present.

**Why:** Without expression statistics, PostgreSQL overestimated rare LIKE
matches and preferred a chronological scan, reading the whole history when fewer
than one full page matched. Higher actor-ID statistics also helped the planner
recognize absent IDs in the identity OR predicate.

**How to apply:** Preserve collection of identity expression statistics and
ANALYZE after introducing them. Compare selective and broad terms, escaped wildcard characters,
no-result searches, date combinations, and populated/exhausted deep pages with
EXPLAIN ANALYZE. Preserve PostgreSQL-side lowercasing and literal escaping. Keep
synthetic benchmark history in connection-local temporary tables, never in the
real append-only audit trail. Offset pagination is intentionally retained for API
compatibility; its cost is still proportional to skipped matching rows.
