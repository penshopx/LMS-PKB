// Run this client from two genuinely different networks; header claims are not
// evidence of network diversity. Outputs booleans only, never server responses.
export async function checkIngressClient(baseUrl: string, client: string): Promise<boolean> {
  if (!["network-a", "network-b"].includes(client)) throw new Error("Invalid client label");
  const configResponse = await fetch(`${baseUrl}/probe/config`);
  if (!configResponse.ok) throw new Error("Ingress check unavailable");
  const { prefix, attempts } = await configResponse.json() as { prefix: string; attempts: number };
  if (attempts !== 31 || !/^ingress-check-[a-f0-9-]+$/.test(prefix)) throw new Error("Invalid check config");
  let passed = true;
  for (let i = 0; i < attempts; i++) {
    // Include whole-chain, loopback, IPv4-mapped and native IPv6 injection,
    // not merely an extra leftmost IPv4 entry.
    const headers: Record<string, string> = {
      "Content-Type": "application/json", "X-Probe-Client": client,
    };
    if (i > 0) {
      headers["X-Forwarded-For"] = [
        `203.0.113.${i}`, `::ffff:203.0.113.${i}`,
        `2001:db8::${i}`, `203.0.113.${i}, 127.0.0.1, ::1`,
      ][i % 4];
      headers["Forwarded"] = `for="[2001:db8::${i}]"`;
      headers["X-Real-IP"] = `198.51.100.${i}`;
    }
    const response = await fetch(`${baseUrl}/api/login`, {
      method: "POST", headers,
      body: JSON.stringify({ username: `${prefix}:${client}:${i}`, password: "invalid-probe-only" }),
      signal: AbortSignal.timeout(15000),
    });
    passed = passed && response.status === (i < attempts - 1 ? 401 : 429);
    if (i === attempts - 1) passed = passed && Number(response.headers.get("retry-after")) > 0;
    await response.arrayBuffer();
  }
  return passed;
}

if (typeof process !== "undefined" && process.argv[1]?.endsWith("login-ingress-client.ts")) {
  try {
    const passed = await checkIngressClient(process.argv[2], process.argv[3]);
    console.log(JSON.stringify({ check: "ingress-client", passed }));
    process.exitCode = passed ? 0 : 1;
  } catch {
    console.log(JSON.stringify({ check: "ingress-client", passed: false }));
    process.exitCode = 1;
  }
}
