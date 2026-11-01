---
name: PostgreSQL concurrency test coordination
description: How to make database concurrency tests deterministic when managed PostgreSQL hides session activity.
---

Do not depend on `pg_stat_activity` to detect blocked test transactions in this environment; session activity may be reported as disabled. Coordinate transaction start and query dispatch through a test-only wrapper or barrier instead.

**Why:** A concurrency test that polled session activity could not observe either blocked worker, even though an external row lock was active. Fixed sleeps were also too timing-dependent to prove overlap.

**How to apply:** When testing concurrent storage operations, gate real transactions in the test harness, confirm every callback has initiated its first database operation, and only then release the lock that controls execution order.

For paths that lock at different stages, coordinate on dispatch of the shared row-lock query rather than entry into a common progress calculation.

**Why:** Lesson completion locks the enrollment before calculating progress; post-test processing reaches that lock later. Waiting for both paths to enter the calculation can deadlock the harness when the post-test transaction is held first.

**How to apply:** Observe the real transaction client's query dispatch without replacing SQL results, hold the first transaction before commit, and release it only after the second dispatches its enrollment lock request. Bound barrier waits and drain requests before restoring observers or deleting fixtures.

For cross-enrollment failure isolation, target fault injection by enrollment identity and require the unaffected request to commit before releasing the failing transaction.

**Why:** A global next-call failure is sensitive to scheduling, and merely awaiting both responses can let sequential execution pass without proving enrollment-level isolation.

**How to apply:** Hold the failing transaction after a verified uncommitted lesson write, await the other participant's successful commit with a bounded wait, then release the failure and inspect raw persisted rows before retrying.