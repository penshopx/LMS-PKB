import { createHash } from "crypto";
import { pool } from "./db";

export const LOGIN_ACCOUNT_MAX_ATTEMPTS = 5;
export const LOGIN_SOURCE_MAX_ATTEMPTS = 30;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

type Reservation = { attempt_key: string; window_started_at: string };
type Bucket = Reservation & { attempt_count: number; retry_after_seconds: number };
type Acquisition =
  | { allowed: true; reservations: Reservation[] }
  | { allowed: false; retryAfterSeconds: number };

// Username matching is case-sensitive, just like the local authentication strategy.
// Hash identifiers so the limiter never stores usernames, addresses or passwords.
export function loginAttemptKeys(username: string, source: string): string[] {
  const digest = (value: string) => createHash("sha256").update(value).digest("hex");
  return [`account:${digest(username)}`, `source:${digest(source)}`];
}

export class LoginAttemptLimiter {
  async tryAcquire(username: string, source: string): Promise<Acquisition> {
    const keys = loginAttemptKeys(username, source);
    await pool.query(
      `DELETE FROM login_attempts
       WHERE window_started_at <= now() - ($1::bigint * interval '1 millisecond')`,
      [LOGIN_WINDOW_MS],
    );
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // All workers reserve account before source. A blocked account rolls back
      // BOTH counters: attacking one account must not exhaust a shared network.
      const { rows } = await client.query<Bucket>(
        `
          INSERT INTO login_attempts (attempt_key, attempt_count, window_started_at)
          VALUES ($1, 1, now()), ($2, 1, now())
          ON CONFLICT (attempt_key) DO UPDATE SET
            attempt_count = CASE
              WHEN login_attempts.window_started_at <= now() - ($3::bigint * interval '1 millisecond')
              THEN 1 ELSE login_attempts.attempt_count + 1 END,
            window_started_at = CASE
              WHEN login_attempts.window_started_at <= now() - ($3::bigint * interval '1 millisecond')
              THEN now() ELSE login_attempts.window_started_at END
          RETURNING attempt_key, attempt_count, window_started_at::text,
            GREATEST(1, CEIL(EXTRACT(EPOCH FROM (
              window_started_at + ($3::bigint * interval '1 millisecond') - now()
            ))))::integer AS retry_after_seconds
        `,
        [...keys, LOGIN_WINDOW_MS],
      );
      const blocked = rows.filter(row => row.attempt_count >
        (row.attempt_key.startsWith("account:") ? LOGIN_ACCOUNT_MAX_ATTEMPTS : LOGIN_SOURCE_MAX_ATTEMPTS));
      if (blocked.length) {
        await client.query("ROLLBACK");
        return { allowed: false, retryAfterSeconds: Math.max(...blocked.map(row => row.retry_after_seconds)) };
      }
      await client.query("COMMIT");
      return { allowed: true, reservations: rows.map(({ attempt_key, window_started_at }) => ({
        attempt_key, window_started_at,
      })) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordSuccess(reservations: Reservation[]): Promise<void> {
    // Refund only this request, never erase concurrent failures or a newer window.
    for (const reservation of reservations) {
      await pool.query(
        `UPDATE login_attempts SET attempt_count = GREATEST(attempt_count - 1, 0)
         WHERE attempt_key = $1 AND window_started_at = $2::timestamptz`,
        [reservation.attempt_key, reservation.window_started_at],
      );
    }
  }
}

export const loginAttemptLimiter = new LoginAttemptLimiter();
