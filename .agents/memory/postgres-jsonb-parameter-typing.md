---
name: PostgreSQL JSONB parameter typing
description: Avoid PostgreSQL unknown-parameter errors when using JSONB operators in Drizzle SQL.
---

When a bound text parameter is used with a PostgreSQL JSONB operator, explicitly cast it to `text` in the SQL expression (for example, `? $1::text`).

**Why:** PostgreSQL can fail to infer the type of a bound parameter in JSONB expressions with error `42P18`, even when the parameter is a JavaScript string.

**How to apply:** Add explicit casts to bound values used by JSONB operators or JSONB construction functions, then verify against PostgreSQL-backed tests.
