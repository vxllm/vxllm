import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@vxllm/db";
import { apiKeys } from "@vxllm/db/schema/settings";
import { env } from "@vxllm/env/server";

// ── In-memory rate limiter (token bucket per key ID) ──────────────────────────
interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();
const REFILL_INTERVAL_MS = 60_000; // 60 seconds

function checkRateLimit(keyId: string, limit: number): boolean {
  const now = Date.now();
  let bucket = buckets.get(keyId);

  if (!bucket) {
    bucket = { tokens: limit - 1, lastRefill: now };
    buckets.set(keyId, bucket);
    return true;
  }

  // Refill tokens if the interval has passed
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= REFILL_INTERVAL_MS) {
    bucket.tokens = limit;
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    return false;
  }

  bucket.tokens -= 1;
  return true;
}

// ── SHA-256 hash helper ───────────────────────────────────────────────────────
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── OpenAI error response helpers ─────────────────────────────────────────────
function unauthorized(c: Context, message: string) {
  return c.json(
    {
      error: {
        message,
        type: "authentication_error",
        code: "invalid_api_key",
        param: null,
      },
    },
    401,
  );
}

function rateLimited(c: Context) {
  return c.json(
    {
      error: {
        message:
          "Rate limit exceeded. Please retry after a brief wait.",
        type: "rate_limit_error",
        code: "rate_limit_exceeded",
        param: null,
      },
    },
    429,
  );
}

// ── Auth Middleware ────────────────────────────────────────────────────────────

/**
 * Authentication middleware for server mode.
 *
 * - Skips auth entirely when HOST is 127.0.0.1 (local development mode).
 * - Skips auth on the /health endpoint.
 * - When HOST is NOT 127.0.0.1 (e.g. 0.0.0.0), auth is enforced:
 *   - Checks localhost requests (127.0.0.1 / ::1) and skips auth for them.
 *   - Extracts Bearer token from Authorization header.
 *   - SHA-256 hashes the token and looks it up in the apiKeys table.
 *   - Validates expiration and rate limits.
 *   - Updates lastUsedAt (fire-and-forget).
 */
export async function authMiddleware(c: Context, next: Next) {
  // If the server is bound to localhost, skip auth entirely
  if (env.HOST === "127.0.0.1" || env.HOST === "localhost") {
    return next();
  }

  // Always allow /health and /metrics without auth
  const path = new URL(c.req.url).pathname;
  if (path === "/health" || path === "/metrics") {
    return next();
  }

  // Skip auth for localhost connections even in server mode.
  // Use Bun's actual TCP connection info — NOT the client-supplied Host header,
  // which can be forged by remote attackers to bypass auth.
  const connInfo = c.req.raw as unknown as { remoteAddr?: { address?: string } };
  const remoteIp =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    connInfo?.remoteAddr?.address ??
    "";

  const isLocalConnection =
    remoteIp === "127.0.0.1" ||
    remoteIp === "::1" ||
    remoteIp === "::ffff:127.0.0.1" ||
    remoteIp === "localhost";

  if (isLocalConnection) {
    return next();
  }

  // Extract Bearer token
  const authHeader = c.req.header("authorization");
  if (!authHeader) {
    return unauthorized(
      c,
      "Missing Authorization header. Expected: Bearer <api-key>",
    );
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    return unauthorized(
      c,
      "Invalid Authorization header format. Expected: Bearer <api-key>",
    );
  }

  const token = match[1];

  // Hash the token and look it up
  const keyHash = await sha256(token);

  let keyRecord;
  try {
    const [row] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    keyRecord = row;
  } catch {
    return c.json(
      {
        error: {
          message: "Authentication service unavailable",
          type: "server_error",
          code: "internal_error",
          param: null,
        },
      },
      503,
    );
  }

  if (!keyRecord) {
    return unauthorized(c, "Invalid API key.");
  }

  // Check expiration
  if (keyRecord.expiresAt && keyRecord.expiresAt < Date.now()) {
    return unauthorized(c, "API key has expired.");
  }

  // Check rate limit
  if (keyRecord.rateLimit) {
    const allowed = checkRateLimit(keyRecord.id, keyRecord.rateLimit);
    if (!allowed) {
      return rateLimited(c);
    }
  }

  // Update lastUsedAt (fire-and-forget — don't await)
  db.update(apiKeys)
    .set({ lastUsedAt: Date.now() })
    .where(eq(apiKeys.id, keyRecord.id))
    .execute()
    .catch(() => {
      // Silently ignore — this is best-effort
    });

  return next();
}
