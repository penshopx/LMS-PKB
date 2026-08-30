import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent, trackGustaftaLinkClick } from "@/lib/analytics";

describe("project analytics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tracks Gustafta clicks with domain, destination, and location", () => {
    const track = vi.fn();
    vi.stubGlobal("window", { umami: { track } });

    trackGustaftaLinkClick({
      domain: "legalitas",
      destination: "sbu-readiness",
      location: "landing",
    });

    expect(track).toHaveBeenCalledWith("gustafta_link_click", {
      domain: "legalitas",
      destination: "sbu-readiness",
      location: "landing",
    });
  });

  it("does not fail when the analytics tracker is unavailable", () => {
    expect(() => trackEvent("gustafta_link_click")).not.toThrow();

    vi.stubGlobal("window", {
      umami: {
        track: () => {
          throw new Error("tracker unavailable");
        },
      },
    });

    expect(() =>
      trackGustaftaLinkClick({
        domain: "all",
        destination: "home",
        location: "sidebar",
      }),
    ).not.toThrow();
  });
});