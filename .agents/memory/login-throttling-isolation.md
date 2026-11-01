---
name: Login throttling isolation
description: Preserve shared-network access and concurrent failure counts when limiting login.
---

Reserve account and source capacity together, rolling back both when either is exhausted. Successful login refunds only its own reservation in its original window, rather than clearing the account's failures.

**Why:** Repeated attacks against an already blocked account must not lock every user on the same network. Clearing counters on success would erase concurrent failures; refunding an expired reservation could weaken a newer window.

**How to apply:** Keep these guarantees when changing login limits or sharing rate-limiter infrastructure. Account-wide limits intentionally apply across sources; source-wide limits also stop attempts distributed across many usernames.
