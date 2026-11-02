---
name: Authentication privacy boundaries
description: Why account changes must invalidate unfinished responses as well as cached LMS data.
---
Treat logout, account switching, and confirmed session expiry as privacy boundaries for both cached data and unfinished requests. A response body can still be downloading after fetch has returned its headers.

**Why:** Browser cookies are shared across tabs. Clearing a cache or navigating to login alone does not stop a late response from restoring data belonging to the previous participant or BUJK.

**How to apply:** New private query and mutation paths must preserve account ownership until response-body consumption is complete. Keep active authentication observers attached when a transition can remain on the same invitation URL. Do not interpret a temporary server/network outage as a confirmed logout.

Browser account-switch checks must preserve the JavaScript runtime through logout and login, and inspect the next account while its real private-data response is still pending.

**Why:** Reloading the document discards the query cache independently of the application's logout logic. Checking only the final settled page can miss previous-account data briefly appearing during loading.

**How to apply:** Use the real login/logout controls and SPA links after initial navigation. Gate delivery of an authentic response rather than replacing its data, and check both the loading state and transient DOM changes.

To test stale private bodies rather than just request cancellation, hold delivery after native fetch and JSON parsing have completed, then release it only after the new account's data has settled. Observe the real query cache as well as DOM mutations.

**Why:** Holding only network fulfillment can let AbortSignal cancel the old request before the ownership check runs, giving false confidence about responses whose body download already finished. PIC team titles and schedules can be legitimate; private reflections and participant reminders are not.

**How to apply:** Keep authentic response data and normal login/logout, gate only body delivery in the browser harness, and distinguish permitted team history from old participant-owned cache entries.

A cross-tab authentication notification makes the old identity unverified immediately; conceal its private UI while checking the shared session, rather than waiting for the new identity to arrive.

**Why:** Another tab can change shared cookies before a slow session check completes. Keeping the previous account visible during that check exposes reminders and open reflections even if the final account view is correct.

**How to apply:** Preserve the old tab's route and runtime, hold authentic session-check responses across real logout/login in a second tab, and assert privacy both before and after verification. Do not use an unrelated focus or polling refresh to make the test pass.
