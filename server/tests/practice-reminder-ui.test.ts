import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeReminders } from "@/components/missions/practice-reminders";

const state = vi.hoisted(() => ({
  user: { id: "account-a", participantId: "learner-a", role: "participant" },
  query: { data: [] as unknown[], isLoading: false, isError: false, refetch: vi.fn() },
  useQuery: vi.fn(),
}));
vi.mock("@/hooks/use-current-user", () => ({ useCurrentUser: () => ({ data: state.user }) }));
vi.mock("@tanstack/react-query", async importOriginal => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQuery: (options: unknown) => { state.useQuery(options); return state.query; },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T17:00:00Z"));
  state.user = { id: "account-a", participantId: "learner-a", role: "participant" };
  state.query.data = [];
  state.query.isLoading = false;
  state.query.isError = false;
  state.useQuery.mockClear();
});
afterEach(() => vi.useRealTimers());
const render = () => renderToStaticMarkup(createElement(Router, { ssrPath: "/app" }, createElement(PracticeReminders)));

describe("pengingat peserta", () => {
  it("menampilkan tiga status, tanggal WIB dan tautan langsung ke misi", () => {
    state.query.data = ["2026-11-01", "2026-11-02", "2026-11-03"].map((date, index) => ({
      submissionId: `submission-${index}`, missionId: `mission-${index}`,
      missionTitle: `Latihan ${index}`, round: 1, nextPracticeAt: date,
    }));
    const html = render();
    for (const label of ["Terlewat", "Hari ini", "Mendatang", "Asia/Jakarta", "2 November 2026 WIB"]) {
      expect(html).toContain(label);
    }
    expect(html.match(/href="\/app\/practice-missions"/g)).toHaveLength(3);
    expect(state.useQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: ["/api/practice-missions/reminders", "account-a"],
      enabled: true, staleTime: 0, refetchInterval: 60_000, refetchOnWindowFocus: true,
    }));
  });

  it("membedakan belum ada jadwal, memuat dan gagal tanpa menampilkan jadwal lama saat error", () => {
    expect(render()).toContain("Tidak ada jadwal latihan ulang");
    state.query.isLoading = true;
    expect(render()).toContain("Memuat jadwal latihan");
    expect(render()).not.toContain("Tidak ada jadwal");
    state.query.isLoading = false;
    state.query.isError = true;
    state.query.data = [{ submissionId: "old", missionId: "old", missionTitle: "Jadwal kedaluwarsa", round: 1, nextPracticeAt: "2026-11-01" }];
    expect(render()).toContain("Pengingat gagal dimuat");
    expect(render()).toContain("Coba lagi");
    expect(render()).not.toContain("Jadwal kedaluwarsa");
  });

  it("tidak menampilkan pengingat bagi PIC atau admin dan membedakan cache antar akun", () => {
    state.user.role = "bujk_pic";
    expect(render()).toBe("");
    expect(state.useQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    state.user.role = "admin";
    expect(render()).toBe("");
    state.user = { id: "account-b", participantId: "learner-b", role: "participant" };
    render();
    expect(state.useQuery).toHaveBeenLastCalledWith(expect.objectContaining({
      queryKey: ["/api/practice-missions/reminders", "account-b"], enabled: true,
    }));
  });
});
