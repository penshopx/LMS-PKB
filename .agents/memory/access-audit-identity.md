---
name: Access audit identity
description: Identity and historical accuracy decisions for account access audit records.
---

Keep the actor and target identities as they were when access changed, independently of the current account lifecycle. Do not cascade-delete audit history with accounts.

**Why:** The access history must remain attributable even after an account changes or is removed. Joining only current account data would lose or rewrite historical attribution.

**How to apply:** Preserve minimal identity snapshots and account identifiers in audit records, never passwords or session data. Do not backfill a change event for pre-existing account status: its actor and actual change time are unknown.
