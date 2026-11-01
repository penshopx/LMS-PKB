---
name: Authentication privacy boundaries
description: Why account changes must invalidate unfinished responses as well as cached LMS data.
---
Treat logout, account switching, and confirmed session expiry as privacy boundaries for both cached data and unfinished requests. A response body can still be downloading after fetch has returned its headers.

**Why:** Browser cookies are shared across tabs. Clearing a cache or navigating to login alone does not stop a late response from restoring data belonging to the previous participant or BUJK.

**How to apply:** New private query and mutation paths must preserve account ownership until response-body consumption is complete. Keep active authentication observers attached when a transition can remain on the same invitation URL. Do not interpret a temporary server/network outage as a confirmed logout.
