---
name: Production runtime environment
description: Why the production run command must explicitly set NODE_ENV even when the server bundle defines it at build time.
---

The production run command must explicitly set `NODE_ENV=production`; do not rely only on a bundler define.

**Why:** Build-time replacement covers direct `process.env.NODE_ENV` expressions but can miss helpers that accept an environment object and read `environment.NODE_ENV`. This caused production-only recovery logic to be skipped while the security guard still ran.

**How to apply:** Keep the Publishing run command routed through the production start script, or otherwise set `NODE_ENV=production` in the runtime command. Verify both direct and injected environment access when adding startup guards or recovery paths.