const REQUIRED_STARTUP_ENV = ["DATABASE_URL", "SESSION_SECRET"] as const;

export type StartupEnvironment = NodeJS.ProcessEnv;

export function getMissingStartupEnvironment(
  environment: StartupEnvironment = process.env,
): string[] {
  return REQUIRED_STARTUP_ENV.filter((name) => !environment[name]?.trim());
}

/**
 * The application cannot serve authenticated, database-backed routes without
 * these values. Validate them before importing modules that initialize either
 * dependency so production exits with one actionable startup error.
 */
export function validateStartupEnvironment(
  environment: StartupEnvironment = process.env,
): void {
  const missing = getMissingStartupEnvironment(environment);
  if (missing.length === 0) return;

  const mode = environment.NODE_ENV === "production" ? "production" : "this environment";
  throw new Error(
    `Missing required environment variable(s) for ${mode}: ${missing.join(", ")}. ` +
      "Set them before starting the application.",
  );
}