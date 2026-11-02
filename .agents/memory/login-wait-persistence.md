---
name: Login wait persistence
description: Privacy and scope decisions for keeping login wait hints across reloads.
---

Keep the login wait hint per tab, account-agnostic, and limited to a deadline. Do not save credentials or an account identifier to associate the hint with an account.

**Why:** Reload should not hide a current wait, but persisting an account-specific association would add private information unnecessarily. Sharing an account-agnostic wait across unrelated tabs could block someone trying a different account.

**How to apply:** Treat persisted values as untrusted display hints with a bounded lifetime. Storage failures must leave login and the current in-memory countdown usable. Clearing or altering the hint cannot grant access; the server still decides whether a login is allowed.
