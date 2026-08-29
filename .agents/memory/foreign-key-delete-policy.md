---
name: Foreign-key delete-policy normalization
description: How to safely replace PostgreSQL foreign-key delete behavior across generated and hand-written schemas.
---

When changing a foreign key's delete policy, discover and remove every foreign
key attached to the target column through PostgreSQL catalogs before installing
one canonical constraint. Do not drop only an assumed constraint name.

**Why:** Generated schemas and hand-written migrations can assign different
names to equivalent foreign keys. PostgreSQL enforces all of them, so one
remaining `RESTRICT` constraint can silently defeat a newly added `CASCADE`.

**How to apply:** Use this whenever a migration changes `ON DELETE` behavior on
an existing relationship, especially when both schema generators and SQL
migrations have managed the same table.