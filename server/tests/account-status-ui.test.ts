import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AccessManagement from "@/pages/access";

// Render the real page with controlled query/state hooks. Capture button handlers
// so confirmations and API wiring are exercised without a browser dependency.
const ui = vi.hoisted(() => ({
  role: "admin",
  accounts: [
    { id: "admin", username: "administrator", role: "admin", isActive: true },
    { id: "learner", username: "peserta", role: "participant", isActive: true },
    { id: "pic", username: "pic-bujk", role: "bujk_pic", isActive: false },
  ],
  states: [] as unknown[],
  stateIndex: 0,
  handlers: new Map<string, { onClick?: (event: { preventDefault: () => void }) => void; disabled?: boolean }>(),
  fields: new Map<string, { onChange: (event: { target: { value: string } }) => void; disabled?: boolean }>(),
  closeDialog: undefined as ((open: boolean) => void) | undefined,
  mutations: [] as any[],
  accountQuery: { isLoading: false, isError: false },
  historyQuery: { data: { entries: [], hasMore: false }, isLoading: false, isError: false },
  historyOptions: undefined as any,
  pending: false,
  mutationError: false,
  apiRequest: vi.fn(),
  invalidate: vi.fn(),
  toast: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = ui.stateIndex++;
      if (!(index in ui.states)) ui.states[index] = initial;
      return [ui.states[index], (value: unknown) => {
        ui.states[index] = typeof value === "function"
          ? (value as (current: unknown) => unknown)(ui.states[index])
          : value;
      }];
    },
  };
});
vi.mock("@/hooks/use-current-user", () => ({ useCurrentUser: () => ({ data: { id: ui.role === "admin" ? "admin-user" : "pic-user", role: ui.role } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: ui.toast }) }));
vi.mock("@/lib/queryClient", () => ({
  apiRequest: ui.apiRequest,
  queryClient: { invalidateQueries: ui.invalidate },
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => {
    const { queryKey } = options;
    if (queryKey[0] === "/api/access/users") {
      return { data: ui.accounts, ...ui.accountQuery, refetch: ui.refetch };
    }
    if (queryKey[0] === "/api/access/status-history") {
      ui.historyOptions = options;
      return { ...ui.historyQuery, refetch: ui.refetch };
    }
    return { data: [] };
  },
  useMutation: (options: any) => {
    ui.mutations.push(options);
    return {
      isPending: ui.pending,
      isError: ui.mutationError,
      reset: () => { ui.mutationError = false; },
      mutate: async (input: unknown) => {
        try { options.onSuccess?.(await options.mutationFn(input)); }
        catch (error) { options.onError?.(error); }
      },
    };
  },
}));
vi.mock("@/components/ui/button", async () => {
  const { createElement } = await import("react");
  return {
    Button: (props: any) => {
      const { children, onClick, disabled, variant, size, ...rest } = props;
      const label = props["aria-label"] ?? children;
      ui.handlers.set(label, { onClick, disabled });
      return createElement("button", { ...rest, disabled }, children);
    },
  };
});
vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: any) => {
    ui.fields.set(props.id, props);
    return createElement("textarea", props);
  },
}));
vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => {
    ui.fields.set(props.id, props);
    return createElement("input", props);
  },
}));
vi.mock("@/components/ui/alert-dialog", async () => {
  const { createElement } = await import("react");
  const Wrapper = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  return {
    AlertDialog: ({ open, children, onOpenChange }: { open: boolean; children: ReactNode; onOpenChange: (open: boolean) => void }) => {
      ui.closeDialog = onOpenChange;
      return open ? children : null;
    },
    AlertDialogContent: Wrapper, AlertDialogHeader: Wrapper, AlertDialogTitle: Wrapper,
    AlertDialogDescription: Wrapper, AlertDialogFooter: Wrapper,
    AlertDialogCancel: Wrapper,
    AlertDialogAction: (props: any) => {
      ui.handlers.set(props.children, props);
      return createElement("button", { disabled: props.disabled }, props.children);
    },
  };
});

function render() {
  ui.stateIndex = 0;
  ui.handlers.clear();
  ui.fields.clear();
  ui.mutations.length = 0;
  return renderToStaticMarkup(createElement(AccessManagement));
}

function click(label: string) {
  const button = ui.handlers.get(label);
  expect(button, `Missing button: ${label}`).toBeDefined();
  expect(button?.disabled).not.toBe(true);
  button?.onClick?.({ preventDefault() {} });
}

function fillReason(value = "Alasan perubahan akses untuk kebutuhan operasional.") {
  const field = ui.fields.get("account-status-reason");
  expect(field).toBeDefined();
  field!.onChange({ target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  ui.states = [];
  ui.role = "admin";
  ui.pending = false;
  ui.mutationError = false;
  ui.accountQuery = { isLoading: false, isError: false };
  ui.historyQuery = { data: { entries: [], hasMore: false }, isLoading: false, isError: false };
  ui.historyOptions = undefined;
  ui.apiRequest.mockImplementation(async (_method: string, path: string, body: { isActive: boolean }) => ({
    json: async () => ({ id: path.split("/")[4], ...body }),
  }));
});

describe("account management UI", () => {
  it("shows status and appropriate controls, never allowing admin status changes", () => {
    const markup = render();
    expect(markup).toContain("Akun pengguna");
    expect(markup).toContain("Status akun peserta: aktif");
    expect(markup).toContain("Status akun pic-bujk: nonaktif");
    expect(ui.handlers.has("Nonaktifkan akun peserta")).toBe(true);
    expect(ui.handlers.has("Aktifkan akun pic-bujk")).toBe(true);
    expect(ui.handlers.has("Nonaktifkan akun administrator")).toBe(false);
    ui.role = "bujk_pic";
    expect(render()).not.toContain("Akun pengguna");
    expect(ui.handlers.has("Nonaktifkan akun peserta")).toBe(false);
  });

  it.each([
    ["Nonaktifkan akun peserta", "Ya, nonaktifkan", "learner", false],
    ["Aktifkan akun pic-bujk", "Ya, aktifkan", "pic", true],
  ] as const)("confirms %s and sends the intended status", async (button, confirm, id, isActive) => {
    render();
    click(button);
    const markup = render();
    expect(markup).toMatch(/[Rr]iwayat belajar.*tetap tersimpan/);
    if (!isActive) expect(markup).toContain("Semua sesi aktif akan dicabut");
    expect(ui.apiRequest).not.toHaveBeenCalled();
    expect(ui.handlers.get(confirm)?.disabled).toBe(true);
    fillReason("  Alasan perubahan akses untuk kebutuhan operasional. \n");
    render();
    click(confirm);
    await vi.waitFor(() => expect(ui.invalidate).toHaveBeenCalledWith({ queryKey: ["/api/access/users"] }));
    expect(ui.invalidate).toHaveBeenCalledWith({ queryKey: ["/api/access/status-history", "admin-user"] });
    expect(ui.apiRequest).toHaveBeenCalledWith("PATCH", `/api/access/users/${id}/status`, {
      isActive, reason: "Alasan perubahan akses untuk kebutuhan operasional.",
    });
    expect(ui.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: isActive ? "Akun diaktifkan" : "Akun dinonaktifkan",
    }));
    expect(render()).not.toContain(confirm);
  });

  it("keeps the confirmation on failure and prevents duplicate submissions while pending", async () => {
    ui.apiRequest.mockRejectedValueOnce(new Error("Jaringan gagal"));
    render();
    click("Nonaktifkan akun peserta");
    render();
    fillReason();
    render();
    click("Ya, nonaktifkan");
    await vi.waitFor(() => expect(ui.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Status akun gagal diperbarui", variant: "destructive",
    })));
    ui.mutationError = true;
    expect(render()).toContain("Perubahan status gagal");
    expect(render()).toContain("Alasan perubahan akses untuk kebutuhan operasional.");
    ui.pending = true;
    render();
    expect(ui.handlers.get("Menyimpan...")?.disabled).toBe(true);
    expect(ui.handlers.get("Nonaktifkan akun peserta")?.disabled).toBe(true);
    expect(ui.fields.get("account-status-reason")?.disabled).toBe(true);
  });

  it("blocks missing, whitespace-only, and overlong reasons even if a disabled handler is invoked", () => {
    render();
    click("Nonaktifkan akun peserta");
    render();
    for (const reason of ["", " \n\t ", "a".repeat(1001)]) {
      fillReason(reason);
      const markup = render();
      expect(markup).toMatch(/maxlength="1000"/i);
      expect(markup).toContain("Jangan masukkan password atau data rahasia");
      expect(ui.handlers.get("Ya, nonaktifkan")?.disabled).toBe(true);
      ui.handlers.get("Ya, nonaktifkan")?.onClick?.({ preventDefault() {} });
      expect(ui.apiRequest).not.toHaveBeenCalled();
    }
  });

  it("clears the reason when a dialog closes or a different target is opened", () => {
    render();
    click("Nonaktifkan akun peserta");
    render();
    fillReason("Alasan khusus untuk peserta pertama.");
    expect(render()).toContain("Alasan khusus untuk peserta pertama.");
    ui.closeDialog!(false);
    render();
    click("Aktifkan akun pic-bujk");
    const markup = render();
    expect(markup).not.toContain("Alasan khusus untuk peserta pertama.");
    expect(ui.handlers.get("Ya, aktifkan")?.disabled).toBe(true);
  });

  it("shows loading and retryable list failures instead of a misleading empty list", () => {
    ui.accountQuery.isLoading = true;
    expect(render()).toContain('aria-busy="true"');
    ui.accountQuery = { isLoading: false, isError: true };
    expect(render()).toContain("Daftar akun gagal dimuat");
    click("Coba lagi");
    expect(ui.refetch).toHaveBeenCalledOnce();
  });

  it("shows account status history only to admins and scopes the query to the current admin", async () => {
    const markup = render();
    expect(markup).toContain("Riwayat perubahan status akun");
    expect(markup).toContain("Belum ada riwayat perubahan status akun");
    expect(ui.historyOptions.enabled).toBe(true);
    expect(ui.historyOptions.queryKey).toEqual(["/api/access/status-history", "admin-user", 0, { actor: "", target: "", from: "", to: "" }]);
    ui.role = "bujk_pic";
    expect(render()).not.toContain("Riwayat perubahan status akun");
    expect(ui.historyOptions.enabled).toBe(false);
    expect(ui.historyOptions.queryKey).toEqual(["/api/access/status-history", "pic-user", 0, { actor: "", target: "", from: "", to: "" }]);
    expect(ui.apiRequest).not.toHaveBeenCalled();
    await ui.historyOptions.queryFn();
    expect(ui.apiRequest).toHaveBeenCalledWith("GET", "/api/access/status-history?offset=0");
  });

  it("renders actor, target, status transition, and WIB timestamp for history entries", () => {
    ui.historyQuery = {
      data: {
        entries: [{
          id: "history-1",
          actorId: "admin-42",
          actorUsername: "admin.audit",
          targetUserId: "learner-17",
          targetUsername: "peserta.audit",
          previousIsActive: true,
          newIsActive: false,
          reason: "Penugasan selesai <script>alert('x')</script>",
          changedAt: "2025-02-10T02:30:00.000Z",
        }],
        hasMore: true,
      },
      isLoading: false,
      isError: false,
    };
    const markup = render();
    expect(markup).toContain("admin.audit");
    expect(markup).toContain("admin-42");
    expect(markup).toContain("peserta.audit");
    expect(markup).toContain("learner-17");
    expect(markup).toContain("Aktif");
    expect(markup).toContain("Nonaktif");
    expect(markup).toContain("WIB");
    expect(markup).toContain("Alasan:");
    expect(markup).toContain("Penugasan selesai &lt;script&gt;");
    expect(markup).not.toContain("<script>");
    expect(ui.handlers.get("Sebelumnya")?.disabled).toBe(true);
    expect(ui.handlers.get("Berikutnya")?.disabled).toBe(false);
  });

  it("shows history loading and retryable error states", () => {
    ui.historyQuery = { data: undefined, isLoading: true, isError: false };
    expect(render()).toContain('aria-label="Memuat riwayat perubahan status"');
    ui.historyQuery = { data: undefined, isLoading: false, isError: true };
    expect(render()).toContain("Riwayat perubahan status gagal dimuat");
    click("Coba lagi");
    expect(ui.refetch).toHaveBeenCalledOnce();
  });

  it("paginates history in pages of 50 and fetches the selected offset", async () => {
    ui.historyQuery = {
      data: {
        entries: [{
          id: "history-1",
          actorId: "admin-42",
          actorUsername: "admin.audit",
          targetUserId: "learner-17",
          targetUsername: "peserta.audit",
          previousIsActive: true,
          newIsActive: false,
          reason: null,
          changedAt: "2025-02-10T02:30:00.000Z",
        }],
        hasMore: true,
      },
      isLoading: false,
      isError: false,
    };
    expect(render()).toContain("Belum dicatat — riwayat sebelum alasan diwajibkan.");
    click("Berikutnya");
    render();
    expect(ui.historyOptions.queryKey).toEqual(["/api/access/status-history", "admin-user", 50, { actor: "", target: "", from: "", to: "" }]);
    await ui.historyOptions.queryFn();
    expect(ui.apiRequest).toHaveBeenCalledWith("GET", "/api/access/status-history?offset=50");
    expect(ui.handlers.get("Sebelumnya")?.disabled).toBe(false);
  });

  it("combines filters, resets pagination on every change, and URL-encodes identities", async () => {
    ui.historyQuery.data = {
      entries: [{ id: "event", actorId: "old-admin", actorUsername: "Old Admin", targetUserId: "deleted",
        targetUsername: "Deleted Target", previousIsActive: true, newIsActive: false,
        reason: null, changedAt: "2030-03-10T00:00:00Z" }] as any,
      hasMore: true,
    };
    render();
    click("Berikutnya");
    render();
    expect(ui.historyOptions.queryKey[2]).toBe(50);
    const values = { actor: "Admin & lama", target: "deleted/id", from: "2030-03-10", to: "2030-03-11" };
    for (const [key, value] of Object.entries(values)) {
      ui.fields.get(`history-${key}`)!.onChange({ target: { value } });
      render();
      expect(ui.historyOptions.queryKey[2]).toBe(0);
      expect(ui.historyOptions.queryKey[3]).toMatchObject({ [key]: value });
      click("Berikutnya");
      render();
    }
    await ui.historyOptions.queryFn();
    expect(ui.apiRequest).toHaveBeenLastCalledWith("GET",
      "/api/access/status-history?offset=50&actor=Admin+%26+lama&target=deleted%2Fid&from=2030-03-10&to=2030-03-11");
    expect(ui.apiRequest.mock.calls.every(([method]) => method === "GET")).toBe(true);
    click("Reset filter");
    render();
    expect(ui.historyOptions.queryKey[2]).toBe(0);
    expect(ui.historyOptions.queryKey[3]).toEqual({ actor: "", target: "", from: "", to: "" });
    expect(ui.handlers.get("Reset filter")?.disabled).toBe(true);
  });

  it("blocks invalid date ranges and explains empty filtered results", () => {
    render();
    ui.fields.get("history-from")!.onChange({ target: { value: "2030-03-11" } });
    render();
    ui.fields.get("history-to")!.onChange({ target: { value: "2030-03-10" } });
    expect(render()).toContain("Filter tanggal tidak valid");
    expect(ui.historyOptions.enabled).toBe(false);
    ui.fields.get("history-to")!.onChange({ target: { value: "2030-03-11" } });
    expect(render()).toContain("Tidak ada riwayat yang cocok dengan filter.");
    expect(ui.historyOptions.enabled).toBe(true);
    expect(render()).not.toContain("Belum ada riwayat perubahan status akun.");
    ui.role = "participant";
    const markup = render();
    expect(ui.historyOptions.enabled).toBe(false);
    expect(markup).not.toContain("history-actor");
    expect(markup).not.toContain("Riwayat perubahan status akun");
  });
});
