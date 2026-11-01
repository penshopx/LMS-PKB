import { describe, expect, it } from "vitest";
import { formatPracticeDate, practiceDueStatus } from "@shared/practice-missions";

describe("jadwal praktik menggunakan hari kalender WIB", () => {
  it("berpindah dari mendatang ke hari ini tepat pukul 00.00 WIB, lalu terlewat", () => {
    expect(practiceDueStatus("2026-11-02", new Date("2026-11-01T16:59:59Z"))).toBe("upcoming");
    expect(practiceDueStatus("2026-11-02", new Date("2026-11-01T17:00:00Z"))).toBe("today");
    expect(practiceDueStatus("2026-11-02", new Date("2026-11-02T16:59:59Z"))).toBe("today");
    expect(practiceDueStatus("2026-11-02", new Date("2026-11-02T17:00:00Z"))).toBe("overdue");
  });

  it("membandingkan tahun, bulan dan hari secara utuh", () => {
    const now = new Date("2026-12-31T17:00:00Z");
    expect(practiceDueStatus("2026-12-31", now)).toBe("overdue");
    expect(practiceDueStatus("2027-01-01", now)).toBe("today");
    expect(practiceDueStatus("2027-02-01", now)).toBe("upcoming");
    expect(practiceDueStatus("2028-02-29", new Date("2028-02-28T17:00:00Z"))).toBe("today");
  });

  it("menampilkan tanggal tanpa bergantung pada zona waktu perangkat", () => {
    expect(formatPracticeDate("2026-11-02")).toBe("2 November 2026");
  });
});
