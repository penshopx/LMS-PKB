---
name: PostgreSQL concurrency test coordination
description: How to make database concurrency tests deterministic when managed PostgreSQL hides session activity.
---

Do not depend on `pg_stat_activity` to detect blocked test transactions in this environment; session activity may be reported as disabled. Coordinate transaction start and query dispatch through a test-only wrapper or barrier instead.

**Why:** A concurrency test that polled session activity could not observe either blocked worker, even though an external row lock was active. Fixed sleeps were also too timing-dependent to prove overlap.

**How to apply:** When testing concurrent storage operations, gate real transactions in the test harness, confirm every callback has initiated its first database operation, and only then release the lock that controls execution order.