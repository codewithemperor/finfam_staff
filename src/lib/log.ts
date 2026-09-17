import "server-only";

/**
 * Safe server-side error logging (production-readiness remediation §21).
 *
 * Replaces the previous pattern of `console.error(scope, error)` which
 * serialised raw Error objects (full stacks, provider internals, and in
 * the worst case library messages carrying data fragments) into the log.
 *
 * The safe pattern is a single structured line:
 *   - a correlation id (returned to the caller so support can grep for it)
 *   - the error CLASS/name (e.g. PrismaClientKnownRequestError, AppError)
 *   - a sanitized one-line message (control characters stripped, length
 *     capped) — never a full stack, never a raw object
 *   - optional already-safe scalar context (ids, counts, route names)
 *
 * It must NEVER receive or emit: OTPs, session tokens, tokenHash/codeHash,
 * Mailjet credentials, NIN/BVN/bank data, or request bodies. Callers pass
 * only scalar identifiers they already know are safe.
 *
 * User-facing 500s remain the existing generic message — the correlation
 * id is additional support context, not new exposure.
 */

const MAX_MESSAGE_LENGTH = 400;

function sanitizeMessage(raw: string): string {
  return raw
    // control characters & newlines → single spaces (one structured line)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

export interface SafeErrorLogFields {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Log an unexpected server error safely and return the correlation id.
 * Never throws — logging must not be able to break a handler.
 */
export function logServerError(
  scope: string,
  error: unknown,
  fields: SafeErrorLogFields = {},
): string {
  try {
    const errorId = crypto.randomUUID();
    const name =
      error instanceof Error
        ? error.name
        : Object.prototype.toString.call(error).slice(8, -1);
    const rawMessage =
      error instanceof Error ? error.message : String(error ?? "unknown");
    const entry = {
      level: "error",
      id: errorId,
      scope,
      error: name,
      message: sanitizeMessage(rawMessage),
      ...fields,
    };
    console.error(JSON.stringify(entry));
    return errorId;
  } catch {
    // Logging itself failed — emit the absolute minimum and move on.
    console.error(JSON.stringify({ level: "error", scope, error: "LogFailure" }));
    return "unavailable";
  }
}
