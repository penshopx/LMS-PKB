import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, expect, it } from "vitest";
import { configureClientSource, normalizeClientSource } from "../client-source";

const servers: Server[] = [];
let edge: string;

async function listen(app: ReturnType<typeof express>) {
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server unavailable");
  return `http://127.0.0.1:${address.port}`;
}

beforeAll(async () => {
  const app = express();
  configureClientSource(app);
  app.get("/", (req, res) => {
    // Return only comparisons, never an address in a test failure.
    const source = normalizeClientSource(req.ip ?? "");
    res.json({
      first: source === "192.0.2.10",
      second: source === "2001:db8:2::10",
      privateClient: source === "10.24.0.9",
      loopbackClient: source === "::1",
    });
  });
  const upstream = await listen(app);
  const sidecar = express();
  sidecar.get("/", async (req, res) => {
    const response = await fetch(upstream, {
      headers: { "X-Forwarded-For": `${req.get("X-Forwarded-For")}, 127.0.0.1` },
    });
    res.json(await response.json());
  });
  const sidecarUrl = await listen(sidecar);
  const ingress = express();
  ingress.get("/:network", async (req, res) => {
    // Only this controlled edge fixture supplies the source; the caller's
    // forwarded chain is kept, as on an append-only ingress.
    const sources: Record<string, string> = {
      a: "::ffff:192.0.2.10", b: "2001:0db8:0002::0010", c: "10.24.0.9", d: "::1",
    };
    const source = sources[req.params.network];
    const supplied = req.get("X-Forwarded-For");
    const response = await fetch(sidecarUrl, {
      headers: { "X-Forwarded-For": `${supplied ? `${supplied}, ` : ""}${source}, 10.23.0.1` },
    });
    res.json(await response.json());
  });
  edge = await listen(ingress);
});

afterAll(async () => {
  await Promise.all(servers.map(server => new Promise<void>((resolve, reject) =>
    server.close(err => err ? reject(err) : resolve()))));
});

it("keeps different edge sources distinct through two real HTTP proxy hops", async () => {
  for (const network of ["a", "b", "c", "d"]) {
    for (const fake of [
      "", "203.0.113.99", "::ffff:203.0.113.99",
      "2001:db8::99, 127.0.0.1, ::1", "127.0.0.1, ::1",
    ]) {
      const response = await fetch(`${edge}/${network}`, {
        headers: {
          ...(fake ? { "X-Forwarded-For": fake } : {}),
          "X-Real-IP": "203.0.113.100",
          Forwarded: 'for="[2001:db8::100]"',
        },
      });
      expect(await response.json()).toEqual({
        first: network === "a", second: network === "b",
        privateClient: network === "c", loopbackClient: network === "d",
      });
    }
  }
});

it("trusts only loopback peers rather than arbitrary direct clients", () => {
  const app = express();
  configureClientSource(app);
  const trust = app.get("trust proxy fn") as (address: string, hop: number) => boolean;
  expect(trust("127.0.0.1", 0)).toBe(true);
  expect(trust("::1", 1)).toBe(true);
  expect(trust("192.0.2.10", 0)).toBe(false);
  expect(trust("2001:db8::10", 0)).toBe(false);
  expect(trust("10.23.0.1", 0)).toBe(false);
  expect(trust("10.23.0.1", 1)).toBe(false);
  expect(trust("10.23.0.1", 2)).toBe(true);
  expect(trust("fd00::1", 2)).toBe(true);
  expect(trust("192.0.2.10", 2)).toBe(false);
  expect(trust("10.23.0.1", 3)).toBe(false);
  expect(trust("127.0.0.1", 3)).toBe(false);
});
