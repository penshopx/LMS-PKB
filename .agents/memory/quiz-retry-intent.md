---
name: Quiz retry intent
description: Rationale for distinguishing uncertain network retries from intentional quiz retakes.
---

Treat retry identity as explicit learner intent, not as a deduction from equal answers or timing. An unconfirmed submission must keep its identity and original payload, including across a page reload in the same browser tab. Acknowledgement permits a new identity for a legitimate retake.

**Why:** The same answers can be submitted legitimately on another attempt, while a lost response can cause an accidental duplicate even though the original attempt committed. Hashing answers alone cannot distinguish these cases. Scoring is mutable during essay review, so it must not define request identity.

**How to apply:** Preserve uncertain submissions rather than silently generating a new key on an error. Reject reuse of an identity with different content. Keep quiz quota, pending-essay restrictions, and ownership checks separate from retry acknowledgement. Never infer or backfill request identities for historical attempts, which lack the learner's original retry intent. Legacy clients without a key remain compatible; the web client must always send one.
