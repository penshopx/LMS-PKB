# Live login ingress check

This opt-in check temporarily replaces **development preview only**, not production.
Do not deploy the harness or mount it in the application.

1. Stop the `Start application` workflow.
2. Run `npx tsx script/check-login-ingress.ts` on the preview's forwarded port 5000.
3. From one network, run
   `npx tsx script/login-ingress-client.ts https://<development-preview-host> network-a`.
4. From a **different egress network**, run the same client with `network-b`.
   Two labels or two spoofed headers on one connection do not count as two networks.
   A browser client is also available at `/probe/run`; `/probe/browser` redirects
   a local preview browser to the external development host before starting it.
   Use this only for the second client, not both second-client runners in one run.
5. Read `/probe/report`: `stable`, `quotas`, `distinct`, and `passed` must all be true.
   Missing clients or a shared source fail the check, never skip it.
6. POST `/probe/finish` to remove the probe's DB buckets and exit with a pass/fail
   status. The harness also expires after three minutes and cleans up on SIGTERM.
7. Restart `Start application`, including after failure.

The real Express auth configuration, login route, PostgreSQL limiter, and 429
response are used. Only bucket names are namespaced for isolation. No real account
is created; every login uses a unique nonexistent username and a synthetic invalid
password. The server retains only per-run HMAC source comparisons, never outputs
them, and emits only boolean results. No raw addresses, forwarded headers,
credentials, cookies, or response bodies are logged. Do not enable HTTP tracing.
An abrupt SIGKILL may leave isolated hashed buckets until their normal 15-minute
expiry, but cannot consume users' normal capacity.

The verified development chain is a loopback socket, another loopback hop, then
one private ingress hop. Trust is bounded to those positions; clients at the next
position are never trusted, even when private or loopback. Do not broaden trust
to all private networks or enable a numeric hop count to make a failing check pass.
Deployment may use a different chain: re-run the check in an approved staging
environment with the production ingress before changing this assumption.

The live check covers the actual available egress families; it must not be described
as native dual-stack coverage unless clients really used both IPv4 and IPv6.
Deterministic local integration cases additionally cover equivalent IPv4/IPv6
spellings and separation of different native IPv6 sources.

## Verification evidence

The initial live run failed: the loopback-only rule selected the shared private
ingress instead of the actual source. The bounded rule was then checked using
the shell client and an independently fetched, JavaScript-rendered browser client
over the external development hostname. Their selected source labels differed.
Both clients had 30 unauthorized responses followed by a 429 with Retry-After;
all spoofing variants retained the original source label. The final report had
`passed`, `stable`, `quotas`, and `distinct` all true, and cleanup exited zero.
The live clients used IPv4; native IPv6 representation/isolation was covered by
the deterministic integration tests, not a claimed live IPv6 connection.
