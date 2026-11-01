/**
 * Temporary live-ingress integration harness, never mounted by the application.
 * See script/login-ingress-check.md. No real users or credentials are needed.
 */
import express from "express";
import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import ipaddr from "ipaddr.js";
import { normalizeClientSource } from "../server/client-source";
import { setupAuth } from "../server/auth";
import { registerRoutes } from "../server/routes";
import {
  loginAttemptLimiter, loginAttemptKeys, LOGIN_SOURCE_MAX_ATTEMPTS,
} from "../server/login-attempt-limiter";
import { pool } from "../server/db";

const prefix = `ingress-check-${randomUUID()}`;
const salt = randomUUID();
const keys = new Set<string>();
const observations = new Map<string, { source: string; status: number }[]>();
const topology = new Map<string, object>();
const app = express();
const server = createServer(app);
let closing = false;

async function close(ok: boolean) {
  if (closing) return;
  closing = true;
  clearTimeout(expiry);
  server.close();
  server.closeAllConnections();
  try {
    await pool.query("DELETE FROM login_attempts WHERE attempt_key = ANY($1::text[])", [[...keys]]);
    await pool.end();
  } catch {
    ok = false;
  }
  console.log(JSON.stringify({ check: "live-login-ingress", passed: ok }));
  process.exit(ok ? 0 : 1);
}

const expiry = setTimeout(() => void close(false), 180_000);
process.on("SIGTERM", () => void close(false));
process.on("SIGINT", () => void close(false));

function report() {
  const clients = ["network-a", "network-b"].map(label => observations.get(label) ?? []);
  const sourceLabels = [...new Set(clients.flatMap(rows => rows.map(row => row.source)))];
  const stable = clients.every(rows => rows.length === LOGIN_SOURCE_MAX_ATTEMPTS + 1 &&
    new Set(rows.map(row => row.source)).size === 1);
  const quotas = clients.every(rows => rows.length === LOGIN_SOURCE_MAX_ATTEMPTS + 1 &&
    rows.every((row, i) => row.status === (i < LOGIN_SOURCE_MAX_ATTEMPTS ? 401 : 429)));
  const distinct = clients.every(rows => rows.length > 0) &&
    clients[0][0].source !== clients[1][0].source;
  return { passed: stable && quotas && distinct, stable, quotas, distinct,
    topology: Object.fromEntries(topology),
    sourceLabels: clients.map(rows => rows.map(row => sourceLabels.indexOf(row.source))),
    statuses: clients.map(rows => rows.map(row => row.status)),
  };
}

// Scope only the probe's reservations so it cannot exhaust a real user's bucket.
// Selection of req.ip, authentication route, DB limiter and 429 response are real.
const acquire = loginAttemptLimiter.tryAcquire.bind(loginAttemptLimiter);
loginAttemptLimiter.tryAcquire = async (username, source) => {
  const scopedSource = `${prefix}:${normalizeClientSource(source)}`;
  loginAttemptKeys(username, scopedSource).forEach(key => keys.add(key));
  return acquire(username, scopedSource);
};

app.use(express.json({ limit: "2kb" }));
app.get("/probe/browser", (_req, res) => {
  const host = process.env.REPLIT_DEV_DOMAIN;
  if (!host || !/^[a-z0-9.-]+\.replit\.dev$/.test(host)) {
    res.sendStatus(503);
    return;
  }
  // The screenshot browser enters on localhost. Redirect before running checks
  // so every request actually crosses the development ingress.
  res.redirect(`https://${host}/probe/run`);
});
app.get("/probe/run", (_req, res) => res.type("html").send(
  '<!doctype html><html><body><h1>Login ingress check</h1><p id="result">Running</p>' +
  '<script type="module">import {checkIngressClient} from "/probe/client.js";' +
  'try { document.querySelector("#result").textContent = await checkIngressClient(location.origin, "network-b") ? "Passed" : "Failed"; }' +
  'catch { document.querySelector("#result").textContent = "Unavailable"; }</script></body></html>',
));
app.get("/probe/client.js", async (_req, res) => {
  const source = await readFile(new URL("./login-ingress-client.ts", import.meta.url), "utf8");
  const compiled = await transform(source, { loader: "ts", format: "esm" });
  res.type("js").send(compiled.code);
});
app.get("/probe/config", (_req, res) => res.json({ prefix, attempts: LOGIN_SOURCE_MAX_ATTEMPTS + 1 }));
app.get("/probe/report", (_req, res) => res.json(report()));
app.post("/probe/finish", (_req, res) => {
  const result = report();
  res.json(result);
  res.on("finish", () => void close(result.passed));
});
// Do not expose the rest of the application's routes during the probe.
app.use((req, res, next) => {
  const client = req.get("X-Probe-Client");
  const rows = client ? observations.get(client) ?? [] : [];
  if (req.method !== "POST" || req.path !== "/api/login" ||
      !["network-a", "network-b"].includes(client ?? "") ||
      rows.length > LOGIN_SOURCE_MAX_ATTEMPTS ||
      req.body?.username !== `${prefix}:${client}:${rows.length}` ||
      req.body?.password !== "invalid-probe-only") {
    res.sendStatus(404);
    return;
  }
  // Reserve the observation before async work, disallowing duplicate indices.
  const observation = { source: "", status: 0 };
  rows.push(observation);
  observations.set(client!, rows);
  res.on("finish", () => { observation.status = res.statusCode; });
  next();
});
setupAuth(app);
app.use((req, _res, next) => {
  const client = req.get("X-Probe-Client")!;
  const rows = observations.get(client);
  const forwarded = (req.get("X-Forwarded-For") ?? "").split(",").map(value => value.trim());
  topology.set(`${client}:${rows!.length - 1}`, {
    selectedSocket: req.ip === req.socket.remoteAddress,
    socketLoopback: ["127.0.0.1", "::1"].includes(normalizeClientSource(req.socket.remoteAddress ?? "")),
    forwardedCount: forwarded.length,
    trustedCount: req.ips.length,
    selectedForwardedIndex: forwarded.indexOf(req.ip ?? ""),
    ranges: forwarded.map(value => ipaddr.isValid(value) ? ipaddr.process(value).range() : "invalid"),
  });
  rows![rows!.length - 1].source = createHmac("sha256", salt)
    .update(normalizeClientSource(req.ip ?? req.socket.remoteAddress ?? "unknown")).digest("hex");
  next();
});
await registerRoutes(server, app);
app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.sendStatus(503); // Never print request data, query parameters or raw errors.
});
server.listen(5000, "0.0.0.0", () => console.log("Temporary ingress check ready"));
