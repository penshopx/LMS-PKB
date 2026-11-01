---
name: Unconfirmed password changes
description: How to communicate and recover from an uncertain password-change outcome.
---
Treat a transport failure, deadline, unreadable response, or server error during password replacement as an unconfirmed outcome, not proof that the old password remains valid. Keep definite validation/authentication rejections distinct.

**Why:** The password transaction may commit before the response is lost or session persistence fails. The assigned product requirement explicitly forbids claiming that aborting the client cancels the server transaction or automatically resubmitting the change.

**How to apply:** Recovery guidance should ask the user to check connectivity and verify access using the new password, then the old password or administrator assistance if needed. Do not introduce automatic retries or weaken session renewal. Any future request abstraction must bound body consumption as well as receipt of headers and discard results from a previous dialog/account.
