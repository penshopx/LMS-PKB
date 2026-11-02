// Display-only hint, never proof that the server will permit a login.
// Per-tab storage avoids carrying an account-agnostic wait into unrelated tabs.
export const LOGIN_COOLDOWN_KEY = "login-cooldown-until";
export const MAX_LOGIN_COOLDOWN_MS = 15 * 60 * 1000;

export function clearLoginCooldown(): void {
  try {
    window.sessionStorage.removeItem(LOGIN_COOLDOWN_KEY);
  } catch {
    // Storage may be disabled; the in-memory timer still works.
  }
}

export function readLoginCooldown(now = Date.now()): number | null {
  try {
    const raw = window.sessionStorage.getItem(LOGIN_COOLDOWN_KEY);
    if (raw === null) return null;
    const until = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(until)
      || until <= now || until - now > MAX_LOGIN_COOLDOWN_MS) {
      clearLoginCooldown();
      return null;
    }
    return until;
  } catch {
    return null;
  }
}

export function startLoginCooldown(seconds: number, now = Date.now()): number | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  // Bound both storage and the display timer, including malformed server metadata.
  const until = now + Math.min(Math.ceil(seconds) * 1000, MAX_LOGIN_COOLDOWN_MS);
  try {
    window.sessionStorage.setItem(LOGIN_COOLDOWN_KEY, String(until));
  } catch {
    // Quota errors and denied access must not break login or its current timer.
  }
  return until;
}

export function loginCooldownSeconds(until: number | null, now = Date.now()): number {
  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
}
