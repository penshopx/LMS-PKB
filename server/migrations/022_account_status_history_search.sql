-- pg_trgm indexes literal substrings (including historical/deleted usernames).
-- Keep the chronological index for broad/short searches and unfiltered pages.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS account_status_history_actor_name_trgm_idx
  ON account_status_history USING gin (lower(actor_username) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS account_status_history_target_name_trgm_idx
  ON account_status_history USING gin (lower(target_username) gin_trgm_ops);
-- Each identity predicate is ID equality OR username substring. Both branches
-- must be indexable so PostgreSQL can choose BitmapOr rather than a full scan.
CREATE INDEX IF NOT EXISTS account_status_history_actor_id_time_idx
  ON account_status_history (actor_id, changed_at, id);
CREATE INDEX IF NOT EXISTS account_status_history_target_id_time_idx
  ON account_status_history (target_user_id, changed_at, id);

-- GIN alone does not provide useful LIKE cardinality estimates. Without these
-- expression statistics LIMIT can wrongly prefer a chronology scan of every
-- row, notably when fewer than limit+1 matches exist (including no matches).
-- Qualify statistics with the table's schema: unlike indexes, they otherwise
-- default to the current schema even when the relation is in another schema.
DO $migration$
DECLARE
  history_schema text;
  identity_column text;
  statistics_name text;
BEGIN
  SELECT n.nspname INTO history_schema
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = 'account_status_history'::regclass;
  FOREACH identity_column IN ARRAY ARRAY['actor_username', 'target_username'] LOOP
    statistics_name := CASE identity_column
      WHEN 'actor_username' THEN 'account_status_history_actor_search_stats'
      ELSE 'account_status_history_target_search_stats' END;
    EXECUTE format('CREATE STATISTICS IF NOT EXISTS %I.%I ON (lower(%I)) FROM %I.account_status_history',
      history_schema, statistics_name, identity_column, history_schema);
    EXECUTE format('ALTER STATISTICS %I.%I SET STATISTICS 1000', history_schema, statistics_name);
  END LOOP;
END
$migration$;
-- Actor IDs are low-cardinality; recognize absent IDs rather than estimating
-- that an unknown literal username must match thousands of actor-ID rows.
ALTER TABLE account_status_history ALTER COLUMN actor_id SET STATISTICS 1000;
ANALYZE account_status_history;
