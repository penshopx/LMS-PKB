# Practice reminder browser checks

Run `npm run dev` in the **Start application** workflow, then:

```sh
npm run test:practice-reminders
```

The suite runs Playwright against the development preview identified by
`REPLIT_DEV_DOMAIN`; it refuses to run with `NODE_ENV=production`. It uses the
installed `/repl/tools/bin/chromium` when available. Elsewhere, install Playwright's
Chromium with `npx playwright install chromium` first.

These are real browser + API + development database checks. Each test creates its
own participant, administrator, course, enrollment, missions and submissions.
Participants sign in through the regular login form; setup/review uses authenticated
API requests. Cleanup logs out the temporary accounts and removes their records in
`finally`, including after failed assertions. No existing account or secret is used.
As with other database-backed checks, do not kill the process during cleanup.

Coverage:

- Repeated SPA navigation between home, missions and the quiz page keeps
  exactly one reminder display timer mounted. Real reminder requests occur once
  per 60-second polling interval (separate from stale-cache mount refetches).
  On the quiz page, three former polling intervals pass with no reminder requests
  or display callbacks. A pass-through timer probe distinguishes the component's
  30-second display effect from unrelated notification timers and checks cleanup;
  no document reload is allowed to mask leaks.
- Both `/app` and `/app/practice-missions` stay mounted across midnight WIB:
  today's reminder becomes overdue and tomorrow's becomes due, before any poll.
  The emulated device timezone is Los Angeles to catch device-local date mistakes.
- New administrator feedback appears after the 60-second polling interval on
  each page, with a negative assertion before that interval.
- New feedback appears on return to a visible page before any poll. Headless
  Chromium keeps background pages visible, so this check simulates only
  `document.visibilityState` and a bubbling `visibilitychange` event. It exercises
  TanStack Query's actual focus listener, fetches, cache and React effects, not
  OS-level window switching.
- Sending a new round through the real form clears reminders on missions and on
  the previously visited home page using SPA links, without a document reload.
  Time stays paused, so polling cannot mask a missing mutation invalidation.
- A logs out and B logs in in the same tab and JS runtime, for both reminder
  pages and for participants in the same or different BUJK. A's real reminder
  and private-history caches are warmed first. B's real reminder response is held
  until the loading card is inspected; a DOM observer also catches transient
  leaks of A's title, schedule or reflection during the switch.
- The same tab then signs in as PIC: neither page requests participant reminders,
  and real, nonempty team submission responses omit private reflections even when
  the PIC opens A's evidence history. No query cache or auth response is mocked.

The browser clock is controlled by Playwright. Tiny clock ticks flush React Query's
zero-delay batched notifications while real HTTP requests finish; no test sleeps
for the full 30/60-second application intervals. Reminder API responses and
production components are not mocked. Existing API tests separately check
graduation, lesson progress and certificates remain unchanged.

Failure screenshots, traces and the HTML report are written under the ignored
`generated-artifacts/practice-reminders/` directory.
