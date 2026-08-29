import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { GustaftaEcosystem } from "@/components/gustafta-ecosystem";
import {
  GUSTAFTA_DOMAINS,
  GUSTAFTA_ECOSYSTEM_LINKS,
  getGustaftaLinksByDomain,
} from "@/lib/gustafta";

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
});