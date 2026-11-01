---
name: Practice reminder calendar
description: Calendar and fulfillment semantics for supplemental practice schedules.
---

Practice date-only schedules are interpreted as whole calendar days in WIB (Asia/Jakarta, UTC+7), not in the device timezone. Sending a new practice round fulfills the earlier round's reminder, even before that new round is reviewed; a network retry of the earlier submission does not.

**Why:** Feedback stores a date without a time or timezone. A fixed, visibly named timezone prevents participants on different devices from seeing contradictory due statuses. Sending evidence is the participant's follow-up action, while review is the administrator's responsibility.

**How to apply:** Keep reminders separate from graduation and certificates. Preserve the same day boundaries and fulfillment meaning when adding new reminder surfaces or channels.
