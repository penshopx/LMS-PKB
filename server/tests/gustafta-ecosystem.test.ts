import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { GustaftaEcosystem } from "@/components/gustafta-ecosystem";
import {
  GUSTAFTA_DOMAINS,
  GUSTAFTA_ECOSYSTEM_LINKS,
  getGustaftaLinksByDomain,
} from "@/lib/gustafta";
import { trackGustaftaLinkClick } from "@/lib/analytics";

describe("Gustafta ecosystem links", () => {
  it("covers each SIAP domain with a primary public destination", () => {
    expect(GUSTAFTA_DOMAINS).toHaveLength(4);

    for (const domain of GUSTAFTA_DOMAINS) {
      const links = getGustaftaLinksByDomain(domain.id);
      expect(links.length).toBeGreaterThan(0);
      expect(links.some((link) => link.primary)).toBe(true);
    }
  });

  it("keeps all destinations on the verified Gustafta host", () => {
    expect(new Set(GUSTAFTA_ECOSYSTEM_LINKS.map((link) => link.id)).size)
      .toBe(GUSTAFTA_ECOSYSTEM_LINKS.length);

    for (const link of GUSTAFTA_ECOSYSTEM_LINKS) {
      expect(link.href).toMatch(/^https:\/\/gustafta\.my\.id\//);
    }
  });

  it("renders external links with safe new-tab behavior", () => {
    const markup = renderToStaticMarkup(createElement(GustaftaEcosystem));

    expect(markup).toContain('data-testid="gustafta-ecosystem"');
    expect(markup.match(/target="_blank"/g)).toHaveLength(GUSTAFTA_ECOSYSTEM_LINKS.length);
    expect(markup.match(/rel="noopener noreferrer"/g)).toHaveLength(GUSTAFTA_ECOSYSTEM_LINKS.length);
  });

  it("tracks clicks with only anonymous dimensions", () => {
    const events: Array<{ name: string; data?: Record<string, unknown> }> = [];
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        umami: {
          track(name: string, data?: Record<string, unknown>) {
            events.push({ name, data });
          },
        },
      },
    });

    try {
      trackGustaftaLinkClick({
        domain: GUSTAFTA_ECOSYSTEM_LINKS[0].domain,
        destination: GUSTAFTA_ECOSYSTEM_LINKS[0].id,
        location: "landing",
      });

      expect(events).toEqual([
        {
          name: "gustafta_link_click",
          data: {
            domain: "legalitas",
            destination: "sbu-readiness",
            location: "landing",
          },
        },
      ]);
      expect(Object.keys(events[0].data ?? {}).sort()).toEqual([
        "destination",
        "domain",
        "location",
      ]);
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: Window }).window;
      } else {
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: originalWindow,
        });
      }
    }
  });

  it("does not fail when analytics is unavailable", () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });

    try {
      expect(() =>
        trackGustaftaLinkClick({
          domain: GUSTAFTA_ECOSYSTEM_LINKS[0].domain,
          destination: GUSTAFTA_ECOSYSTEM_LINKS[0].id,
          location: "dashboard",
        }),
      ).not.toThrow();
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: Window }).window;
      } else {
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: originalWindow,
        });
      }
    }
  });
});