import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { acceptedPasswords, rejectedPasswords } from "./helpers/password-policy";

const ui = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  refs: [] as { current: unknown }[],
  refIndex: 0,
  mutate: vi.fn(),
  pending: false,
  onOpenChange: vi.fn(),
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: vi.fn(),
  useRef: (initial: unknown) => {
    const index = ui.refIndex++;
    return ui.refs[index] ??= { current: initial };
  },
  useState: (initial: unknown) => {
    const index = ui.index++;
    if (!(index in ui.states)) ui.states[index] = initial;
    return [ui.states[index], (value: unknown) => { ui.states[index] = value; }];
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: ui.mutate, reset: vi.fn(), isPending: ui.pending, isSuccess: false, isError: false }),
}));
vi.mock("@/lib/queryClient", () => ({ getSessionEpoch: () => 0 }));
vi.mock("@/components/ui/dialog", () => {
  const Container = ({ children }: { children: ReactNode }) => children;
  return Object.fromEntries([
    "Dialog", "DialogContent", "DialogDescription", "DialogFooter",
    "DialogHeader", "DialogTitle",
  ].map(name => [name, Container]));
});

function render() {
  ui.index = 0;
  ui.refIndex = 0;
  return ChangePasswordDialog({ open: true, onOpenChange: ui.onOpenChange });
}

function find(node: ReactNode, predicate: (element: ReactElement<any>) => boolean): ReactElement<any> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (predicate(child)) return child;
    const result = find(child.props.children, predicate);
    if (result) return result;
  }
}

function submit(password: string, confirmation = password, current = "admin123") {
  ui.states = [current, password, confirmation, ""];
  const tree = render();
  const form = find(tree, element => element.type === "form");
  expect(form).toBeDefined();
  form!.props.onSubmit({ preventDefault: vi.fn() });
  return renderToStaticMarkup(render());
}

beforeEach(() => {
  ui.states = [];
  ui.refs = [];
  ui.index = 0;
  ui.mutate.mockReset();
  ui.pending = false;
  ui.onOpenChange.mockReset();
});

describe("change password dialog validation", () => {
  it.each(rejectedPasswords)("blocks %j with the same message as the API", (password, message) => {
    expect(submit(password)).toContain(message);
    expect(ui.mutate).not.toHaveBeenCalled();
  });

  it.each(acceptedPasswords)("submits %j unchanged, including an existing short current password", password => {
    submit(password);
    expect(ui.mutate).toHaveBeenCalledExactlyOnceWith({ currentPassword: "admin123", newPassword: password });
  });

  it("shows the length policy and associates it with the new password field", () => {
    const tree = render();
    expect(find(tree, element => element.props.id === "new-password")?.props["aria-describedby"])
      .toBe("new-password-help");
    const markup = renderToStaticMarkup(tree);
    expect(markup).toContain("Minimal 12 karakter");
    expect(markup).toContain("maksimal 128 karakter");
    expect(markup).not.toContain("6 karakter");
    for (const id of ["new-password", "confirm-password"]) {
      expect(find(tree, element => element.props.id === id)?.props).toMatchObject({
        minLength: 12, maxLength: 128, required: true,
      });
    }
  });

  it("rejects a password identical to the current password before sending any request", () => {
    expect(submit("current-password", "current-password", "current-password"))
      .toContain("Kata sandi baru harus berbeda dari kata sandi saat ini.");
    expect(ui.mutate).not.toHaveBeenCalled();
  });

  it("does not silently trim a distinct replacement password", () => {
    submit(" current-password ", " current-password ", "current-password");
    expect(ui.mutate).toHaveBeenCalledExactlyOnceWith({
      currentPassword: "current-password", newPassword: " current-password ",
    });
  });

  it("preserves required-field and confirmation validation", () => {
    expect(submit("abcdefghijkl", "different-password")).toContain("Konfirmasi password tidak cocok");
    expect(submit("abcdefghijkl", "", "admin123")).toContain("Semua field wajib diisi");
    expect(submit("abcdefghijkl", "abcdefghijkl", "")).toContain("Semua field wajib diisi");
    expect(ui.mutate).not.toHaveBeenCalled();
  });

  it("shows length errors beside the field while typing and keeps Save disabled", () => {
    let tree = render();
    expect(find(tree, element => element.props["data-testid"] === "button-submit-change-password")?.props.disabled).toBe(true);
    find(tree, element => element.props.id === "new-password")!.props.onChange({ target: { value: "a".repeat(11) } });
    tree = render();
    const error = find(tree, element => element.props.id === "new-password-error");
    expect(error?.props.role).toBe("alert");
    expect(error?.props.children).toContain("minimal 12 karakter");
    expect(find(tree, element => element.props.id === "new-password")?.props["aria-invalid"]).toBe(true);
    expect(find(tree, element => element.props["data-testid"] === "button-submit-change-password")?.props.disabled).toBe(true);
    expect(ui.mutate).not.toHaveBeenCalled();
  });

  it("enables Save only for complete, valid and different credentials", () => {
    for (const [current, next, confirmation, disabled] of [
      ["", "abcdefghijkl", "abcdefghijkl", true],
      ["current-password", "a".repeat(11), "a".repeat(11), true],
      ["current-password", " abcdefghijk ", " abcdefghijk ", true],
      ["current-password", "password123456", "password123456", true],
      ["current-password", "current-password", "current-password", true],
      ["current-password", "abcdefghijkl", "not-the-same", true],
      ["current-password", "abcdefghijkl", "abcdefghijkl", false],
      ["current-password", "a".repeat(128), "a".repeat(128), false],
      ["current-password", "a".repeat(129), "a".repeat(129), true],
    ] as const) {
      ui.states = [current, next, confirmation, ""];
      expect(find(render(), element => element.props["data-testid"] === "button-submit-change-password")?.props.disabled).toBe(disabled);
    }
    ui.pending = true;
    ui.states = ["current-password", "abcdefghijkl", "abcdefghijkl", ""];
    expect(find(render(), element => element.props["data-testid"] === "button-submit-change-password")?.props.disabled).toBe(true);
  });

  it("clears field values when dismissed but prevents dismissal during a save", () => {
    ui.states = ["current-password", "replacement-pass", "replacement-pass", "", true, true];
    const tree = render();
    tree.props.onOpenChange(false);
    expect(ui.onOpenChange).toHaveBeenCalledWith(false);
    expect(ui.states.slice(0, 6)).toEqual(["", "", "", "", false, false]);
    ui.onOpenChange.mockClear();
    ui.pending = true;
    ui.states = ["current-password", "replacement-pass", "replacement-pass", ""];
    render().props.onOpenChange(false);
    expect(ui.onOpenChange).not.toHaveBeenCalled();
    expect(ui.states[0]).toBe("current-password");
  });
});
