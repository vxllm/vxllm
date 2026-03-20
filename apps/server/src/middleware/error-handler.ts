import type { Context, Next } from "hono";

/**
 * Global error handler middleware.
 *
 * Catches unhandled errors from downstream handlers and returns them
 * in OpenAI-compatible error format with appropriate HTTP status codes.
 */
export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (err: unknown) {
    const error = err as Error & {
      status?: number;
      code?: string;
      param?: string;
    };
    const status = error.status ?? 500;
    const type =
      status === 400
        ? "invalid_request_error"
        : status === 401
          ? "authentication_error"
          : status === 404
            ? "not_found_error"
            : status === 429
              ? "rate_limit_error"
              : "server_error";

    console.error(
      `[error] ${c.req.method} ${c.req.path} — ${status} ${error.message}`,
    );

    return c.json(
      {
        error: {
          message: error.message ?? "Internal server error",
          type,
          code: error.code ?? null,
          param: error.param ?? null,
        },
      },
      status as any,
    );
  }
}
