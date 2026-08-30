import type { GustaftaDomainId, GustaftaLinkLocation } from "@/lib/gustafta";

type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never break the app.
  }
}

export function trackGustaftaLinkClick({
  domain,
  destination,
  location,
}: {
  domain: GustaftaDomainId | "all";
  destination: string;
  location: GustaftaLinkLocation;
}): void {
  trackEvent("gustafta_link_click", {
    domain,
    destination,
    location,
  });
}