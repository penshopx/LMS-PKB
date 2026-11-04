import { sql } from "drizzle-orm";
import { coursesTable, type Lesson } from "../shared/schema";

// Keep saved admin choices (including an explicitly emptied list) when the
// baseline catalog refreshes its lesson text during startup.
export function catalogLessonsPreservingReferences(lessons: Lesson[]) {
  return sql`(
    SELECT COALESCE(jsonb_agg(
      CASE WHEN existing.lesson ? 'references'
        THEN baseline.lesson || jsonb_build_object('references', existing.lesson->'references')
        ELSE baseline.lesson END
      ORDER BY baseline.position
    ), '[]'::jsonb)
    FROM jsonb_array_elements(${JSON.stringify(lessons)}::jsonb)
      WITH ORDINALITY AS baseline(lesson, position)
    LEFT JOIN LATERAL (
      SELECT value AS lesson FROM jsonb_array_elements(${coursesTable.lessons})
      WHERE value->>'id' = baseline.lesson->>'id'
      LIMIT 1
    ) AS existing ON true
  )`;
}
