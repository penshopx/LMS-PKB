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

Integration tests share the real database. Broadcast-to-admin activity from another suite may arrive while an authentication test is asserting security alerts. Compare only the notification category under test, and compare unordered database results by stable identity unless ordering is part of the contract.

**Why:** Legitimate concurrent discussion notices can change an admin's notification list, and PostgreSQL scan order can change without any mutation. Assuming either is fixed produces unrelated intermittent failures.

**How to apply:** Keep ownership assertions across all returned notices, but scope category-specific creation/count assertions to that category. Clean broadcast notices using the originating fixture, not just its recipient accounts. For mutation-preservation checks, compare sorted copies or keyed records, retaining all field assertions.

Consume the complete login response before directly fault-injecting the persisted session in tests.

**Why:** Fetch resolves on headers, while express-session may still be completing its final save. An immediate database mutation can be overwritten by the legitimate request that created the session, especially under concurrent test load.

**How to apply:** Await the authentic login body before changing its database session; do not use fixed sleeps or alter authentication middleware to accommodate this test race.