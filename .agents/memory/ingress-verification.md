---
name: Ingress verification boundaries
description: Distinguish real external ingress evidence from local and shared-egress test clients.
---

Use distinct source comparisons at the application boundary to establish network
diversity; different tools or client labels are not proof of different networks.
A localhost screenshot does not cross the external ingress.

**Why:** Local HTTP tests passed while the development ingress selected a shared
intermediate proxy and combined unrelated login sources. Shell and sandbox
requests also shared the same apparent network. An independently rendered remote
browser request exposed the missing trust boundary without recording addresses.

**How to apply:** Use temporary, isolated probes with per-run anonymous source
comparisons, check forged whole chains as well as leftmost entries, and restore
the normal app afterwards. Do not broaden trust just to make a test pass.
Development ingress evidence is not proof of production topology or native IPv6
connectivity; verify each separately before claiming either.
