---
name: Unified password policy
description: User-approved password requirements and preservation of existing credentials.
---
Invitation signup and password replacement must use the same policy: minimum 12 characters excluding leading/trailing whitespace, maximum 128 characters, and rejection of the agreed weak-password examples. A replacement must differ from the current password.

**Why:** The user explicitly approved aligning these flows and rejecting an unchanged replacement without automatically changing existing account passwords.

**How to apply:** Enforce the policy in both forms and the server. Whitespace handling is validation only: do not trim the actual password before hashing or login. Existing short passwords remain compatible with login until the user explicitly changes them; do not add a background password migration.
