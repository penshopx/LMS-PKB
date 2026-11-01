import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { acceptedPasswords, rejectedPasswords } from "./helpers/password-policy";

const ui = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  mutate: vi.fn(),
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = ui.index++;
    if (!(index in ui.states)) ui.states[index] = initial;
    return [ui.states[index], (value: unknown) => { ui.states[index] = value; }];
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: ui.mutate, reset: vi.fn(), isPending: false, isSuccess: false, isError: false }),
}));
vi.mock("@/components/ui/dialog", () => {
  const Container = ({ children }: { children: ReactNode }) => children;
  return Object.fromEntries([
    "Dialog", "DialogContent", "DialogDescription", "DialogFooter",
    "DialogHeader", "DialogTitle",
  ].map(name => [name, Container]));
});

function render() {
  ui.index = 0;
  return ChangePasswordDialog({ open: true, onOpenChange: vi.fn() });
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
  ui.index = 0;
  ui.mutate.mockReset();
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
  });

  it("preserves required-field and confirmation validation", () => {
    expect(submit("abcdefghijkl", "different-password")).toContain("Konfirmasi password tidak cocok");
    expect(submit("abcdefghijkl", "", "admin123")).toContain("Semua field wajib diisi");
    expect(submit("abcdefghijkl", "abcdefghijkl", "")).toContain("Semua field wajib diisi");
    expect(ui.mutate).not.toHaveBeenCalled();
  });
});
