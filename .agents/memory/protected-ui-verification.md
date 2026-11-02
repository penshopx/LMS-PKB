---
name: Protected UI verification
description: A testing capability mismatch and the requirement to verify protected pages without bypassing authentication.
---
The documented testing-worker configuration was rejected as unsupported by this runtime. This was a tooling capability mismatch, not an application authentication failure. Installed Chromium and the existing WebSocket dependency allowed real browser verification instead.

**Why:** A signed-out screenshot cannot establish whether a private dialog behaves correctly. Weakening authentication to make screenshots accessible would create a security risk.

**How to apply:** Keep normal sign-in intact, use uniquely named disposable participant fixtures, and remove them even when a browser check fails. Reuse available browser tooling rather than repeatedly invoking an unsupported worker. Capabilities can change, so do not generalize this limitation to other projects or future runtimes.

For focus-return checks, headless Chromium here continued reporting background pages as visible even after focus emulation was disabled and tabs/windows were switched. Simulating the visibility signal in a real browser is an acceptable deterministic check of the application's focus listener, but is not verification of OS-level tab switching.

**Why:** Browser automation visibility behavior can prevent a real tab switch from reaching the application's listener, independently of whether the application works.

**How to apply:** Clearly distinguish a simulated visibility event from an actual window-focus test. Keep authentication, HTTP requests, query cache, and component effects real; do not weaken the app to accommodate the browser harness.

Browser clock installation starts time advancing before a subsequent pause command arrives. Installing and pausing at the identical instant can intermittently fail because the pause target is already in the past.

**Why:** Separate browser commands incur scheduling latency even when the test expects time to be frozen.

**How to apply:** Install the clock slightly before the desired pause instant, then pause at that instant before exercising timed behavior. Preserve the intended calendar boundary rather than retrying a flaky setup.
