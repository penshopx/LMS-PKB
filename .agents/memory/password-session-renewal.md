---
name: Password session renewal
description: Security boundary when preserving the session that changes a password.
---
Preserve the changing session using only the session version issued by its own password update; never refresh it by adopting the latest version from a separate account lookup.

**Why:** A later lookup can observe a concurrent deactivation, reactivation, or another password change and accidentally authorize a session that the later action intended to revoke.

**How to apply:** Keep this boundary when refactoring password changes or session renewal. If saving the preserved session fails, report failure rather than pretending session continuity succeeded; other sessions must remain revoked.
