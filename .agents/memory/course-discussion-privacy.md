---
name: Course discussion privacy
description: Product boundaries for group discussions, independent questions, and notification visibility.
---

Independent participants' questions are visible only to the sender and admin until a sharing policy is explicitly approved. Joining a group later must not retroactively publish those questions. Group discussions are limited to the viewer's current group and enrolled course; coordinators are read-only in their own group.

**Why:** The user explicitly requires private independent questions, no cross-group disclosure, and coordinator read-only access. A later membership change is not consent to share past private content.

**How to apply:** Preserve the scope captured when a question was created, authorize the current viewer on every read/write, and never use notification delivery as authorization. Notices must not quote question/reply content or expose group/author identity; a saved link may outlive the viewer's membership. Hidden content is for admin review only. Forum participation must not change graduation or imply official credit/SKK.

Require new authorization on forum entry and every notification navigation, including repeated links to the current thread. Conceal all previously fetched discussion content while revalidating; do not rely on an account identity refresh to notice participant-group changes.

**Why:** Group membership can change independently of the account's identity record. Server authorization on new requests does not prevent a client cache from redisplaying a former group's content without a request.

**How to apply:** Override long-lived global query defaults for permission-sensitive forum views. Revalidate on entry, thread-route changes, focus/reconnect, and same-route notification clicks; discard superseded requests and avoid rendering old bodies during revalidation or after access errors. Browser tests must keep the runtime through membership changes and gate authentic responses to check the loading boundary, not just the final page.
