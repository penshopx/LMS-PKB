---
name: Account reactivation policy
description: Security semantics for temporarily disabling and restoring LMS accounts.
---

Reactivating an account restores permission to log in, not permission to reuse a session issued before deactivation. Sessions that were never used while the account was inactive must also remain invalid.

**Why:** Account access may end because a participant or PIC no longer holds their role. Restoring access later must not silently restore previously shared or compromised sessions.

**How to apply:** Preserve this distinction when changing authentication, session storage, or administrative account controls. Require a fresh login after reactivation, while retaining learning history.
