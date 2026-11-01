---
name: Protected UI verification
description: A testing capability mismatch and the requirement to verify protected pages without bypassing authentication.
---
The documented testing-worker configuration was rejected as unsupported by this runtime. This was a tooling capability mismatch, not an application authentication failure. Installed Chromium and the existing WebSocket dependency allowed real browser verification instead.

**Why:** A signed-out screenshot cannot establish whether a private dialog behaves correctly. Weakening authentication to make screenshots accessible would create a security risk.

**How to apply:** Keep normal sign-in intact, use uniquely named disposable participant fixtures, and remove them even when a browser check fails. Reuse available browser tooling rather than repeatedly invoking an unsupported worker. Capabilities can change, so do not generalize this limitation to other projects or future runtimes.
