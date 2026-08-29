-- Older schemas used different names for the learning-record course FK.
-- Remove every FK attached to course_id, then install one canonical cascade.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT constraint_info.conname
    FROM pg_constraint constraint_info
    JOIN pg_class relation
      ON relation.oid = constraint_info.conrelid
    JOIN pg_namespace namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = current_schema()
      AND relation.relname = 'learning_records'
      AND constraint_info.contype = 'f'
      AND EXISTS (
        SELECT 1
        FROM unnest(constraint_info.conkey) AS key_column(attnum)
        JOIN pg_attribute attribute
          ON attribute.attrelid = relation.oid
         AND attribute.attnum = key_column.attnum
        WHERE attribute.attname = 'course_id'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE learning_records DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;
END;
$$;

ALTER TABLE learning_records
  ADD CONSTRAINT learning_records_course_id_fk
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;