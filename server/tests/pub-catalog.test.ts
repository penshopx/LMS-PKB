import { describe, expect, it } from "vitest";
import {
  PUB_CLUSTERS,
  PUB_COURSES,
  PUB_LEARNING_PATHS,
  PUB_PARTICIPANTS,
  PUB_UNITS,
} from "../pub-catalog";

describe("PUB-ASPEKINDO catalog", () => {
  it("contains the four SIAP domains and both compliance clusters", () => {
    expect(PUB_CLUSTERS.map(cluster => cluster.code)).toEqual([
      "LEGAL",
      "SERT",
      "TENDER",
      "PROYEK",
      "SMAP",
      "PANCEK",
    ]);
    expect(PUB_CLUSTERS.find(cluster => cluster.code === "SMAP")?.fullName)
      .toBe("Sistem Manajemen Anti Penyuapan");
  });

  it("keeps all unit and course relationships valid and unique", () => {
    const clusterIds = new Set(PUB_CLUSTERS.map(cluster => cluster.id));
    const unitIds = new Set(PUB_UNITS.map(unit => unit.id));

    expect(clusterIds.size).toBe(PUB_CLUSTERS.length);
    expect(unitIds.size).toBe(PUB_UNITS.length);
    expect(new Set(PUB_UNITS.map(unit => unit.code)).size).toBe(PUB_UNITS.length);
    expect(PUB_UNITS.every(unit => clusterIds.has(unit.clusterId))).toBe(true);
    expect(PUB_COURSES.every(course => unitIds.has(course.unitId))).toBe(true);
    expect(new Set(PUB_COURSES.map(course => course.unitId))).toEqual(unitIds);
    const courseIds = new Set(PUB_COURSES.map(course => course.id));
    expect(PUB_LEARNING_PATHS.every(path => path.courseIds.every(id => courseIds.has(id)))).toBe(true);
    expect(PUB_PARTICIPANTS.every(participant =>
      participant.competencies.every(competency => unitIds.has(competency.unitId))
      && participant.evidences.every(evidence => unitIds.has(evidence.unitId))
      && participant.learningHistory.every(record => courseIds.has(record.courseId))
    )).toBe(true);
  });

  it("uses the unchanged six-step LMS flow for every baseline course", () => {
    const expectedTypes = [
      "orientation",
      "context",
      "microlearning",
      "practice",
      "assessment",
      "reflection",
    ];

    for (const course of PUB_COURSES) {
      expect(course.lessons.map(lesson => lesson.order)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(course.lessons.map(lesson => lesson.type)).toEqual(expectedTypes);
      expect(course.title.toLowerCase()).not.toContain("lkut");
    }
  });
});