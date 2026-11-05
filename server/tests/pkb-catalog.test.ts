import { describe, expect, it } from "vitest";
import {
  PKB_CLUSTERS, PKB_COURSES, PKB_UNITS, PKB_LEARNING_PATHS,
  LEGACY_BUJK_CLUSTER_IDS, LEGACY_BUJK_COURSE_IDS, LEGACY_BUJK_UNIT_IDS, LEGACY_BUJK_PATH_IDS,
} from "../pkb-catalog";
import { PUB_CLUSTERS, PUB_COURSES, PUB_UNITS, PUB_LEARNING_PATHS } from "../pub-catalog";
import { PKB_QUIZZES } from "../../shared/pkb-course";
import { lessonReferencesSchema } from "../../shared/course-references";

describe("PKB curriculum and legacy archive boundary", () => {
  it("recognizes every original baseline entry without treating custom content as legacy", () => {
    expect([...LEGACY_BUJK_CLUSTER_IDS].sort()).toEqual(PUB_CLUSTERS.map(item => item.id).sort());
    expect([...LEGACY_BUJK_UNIT_IDS].sort()).toEqual(PUB_UNITS.map(item => item.id).sort());
    expect([...LEGACY_BUJK_COURSE_IDS].sort()).toEqual(PUB_COURSES.map(item => item.id).sort());
    expect([...LEGACY_BUJK_PATH_IDS].sort()).toEqual(PUB_LEARNING_PATHS.map(item => item.id).sort());
    expect(LEGACY_BUJK_COURSE_IDS.has("course-custom")).toBe(false);
  });

  it("uses separate IDs so old completions and certificates cannot change meaning", () => {
    for (const item of PKB_CLUSTERS) expect(LEGACY_BUJK_CLUSTER_IDS.has(item.id)).toBe(false);
    for (const item of PKB_UNITS) expect(LEGACY_BUJK_UNIT_IDS.has(item.id)).toBe(false);
    for (const item of PKB_COURSES) expect(LEGACY_BUJK_COURSE_IDS.has(item.id)).toBe(false);
    for (const item of PKB_LEARNING_PATHS) expect(LEGACY_BUJK_PATH_IDS.has(item.id)).toBe(false);
    expect(new Set(PKB_COURSES.map(item => item.id)).size).toBe(PKB_COURSES.length);
  });

  it("covers the main and supporting activities without classifying other main activities as supporting", () => {
    expect(PKB_UNITS).toHaveLength(16);
    expect(PKB_UNITS.find(unit => unit.id === "pkb-other")?.clusterId).toBe("pkb-cluster-other");
    expect(PKB_UNITS.filter(unit => unit.clusterId === "pkb-cluster-support")).toHaveLength(3);
    for (const unit of PKB_UNITS) expect(PKB_CLUSTERS.some(cluster => cluster.id === unit.clusterId)).toBe(true);
  });

  it("provides six learning steps and valid references to the supplied regulation", () => {
    for (const course of PKB_COURSES) {
      expect(PKB_UNITS.some(unit => unit.id === course.unitId)).toBe(true);
      expect(course.lessons.map(lesson => lesson.type)).toEqual(["orientation", "context", "microlearning", "practice", "assessment", "reflection"]);
      const references = course.lessons.find(lesson => lesson.type === "microlearning")?.references;
      expect(lessonReferencesSchema.safeParse(references).success).toBe(true);
      expect(references?.every(reference => reference.sourceId === "PKB-12-2021")).toBe(true);
      expect(course.lessons.map(lesson => lesson.content).join(" ")).toContain("bukan");
    }
  });

  it("links paths and assessments only to the new curriculum", () => {
    const ids = new Set(PKB_COURSES.map(course => course.id));
    for (const path of PKB_LEARNING_PATHS) expect(path.courseIds.every(id => ids.has(id))).toBe(true);
    for (const quiz of PKB_QUIZZES) expect(ids.has(quiz.courseId)).toBe(true);
    expect(PKB_QUIZZES.find(quiz => quiz.id.endsWith("posttest"))?.passingScore).toBe(60);
    expect(PKB_QUIZZES.find(quiz => quiz.id.endsWith("pretest"))?.passingScore).toBe(0);
  });
});
