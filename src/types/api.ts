/**
 * Shared API contract types.
 *
 * Every route handler responds with one of these envelopes so the client
 * helper (src/lib/api/client.ts) can surface consistent, human-readable
 * errors. Never leak stack traces, SQL errors or driver details here.
 */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "INTERNAL";

export interface ApiFieldErrors {
  [field: string]: string;
}

export interface ApiSuccessBody<TData> {
  ok: true;
  data: TData;
}

export interface ApiErrorBody {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: ApiFieldErrors;
    /**
     * Correlation id for unexpected 500s (production-readiness remediation
     * §21): lets support grep the server log for the exact failure. The
     * response message itself remains generic — this id exposes nothing.
     */
    reference?: string;
  };
}

export type ApiResponseBody<TData> = ApiSuccessBody<TData> | ApiErrorBody;
