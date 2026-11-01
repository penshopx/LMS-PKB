import type { Express } from "express";
import ipaddr from "ipaddr.js";

export function configureClientSource(app: Express): void {
  app.set("trust proxy", trustClientProxy);
}

export function trustClientProxy(address: string, hop: number): boolean {
  if (!ipaddr.isValid(address)) return false;
  const range = ipaddr.process(address).range();
  // Verified preview chain, read from the application outwards:
  // loopback socket -> loopback sidecar -> private ingress -> client.
  // Never trust private direct peers, an arbitrary hop count, or the client's
  // own address at hop 3 (even if it is private/loopback).
  if (hop === 0 || hop === 1) return range === "loopback";
  return hop === 2 && (range === "private" || range === "uniqueLocal");
}

export function normalizeClientSource(source: string): string {
  // Equivalent textual addresses must share capacity. Do not collapse unrelated
  // IPv6 clients into a subnet or merge native IPv6 with a different IPv4 host.
  return ipaddr.isValid(source) ? ipaddr.process(source).toString() : source;
}
