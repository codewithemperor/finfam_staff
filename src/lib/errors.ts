import type { ApiErrorCode, ApiFieldErrors } from "@/types/api";

/**
 * Application error type used across the server layers.
 *
 * Route handlers catch AppError and convert it to the standard API error
 * envelope with a human-readable message. Anything that is not an AppError
 * is logged server-side and returned as a generic, safe message.
 */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields?: ApiFieldErrors;

  constructor(
    code: ApiErrorCode,
    message: string,
    options?: { status?: number; fields?: ApiFieldErrors },
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = options?.status ?? 400;
    this.fields = options?.fields;
  }
}

export function validationError(
  message: string,
  fields?: ApiFieldErrors,
): AppError {
  return new AppError("VALIDATION_ERROR", message, { status: 422, fields });
}

export function notFoundError(message: string): AppError {
  return new AppError("NOT_FOUND", message, { status: 404 });
}

export function conflictError(
  message: string,
  fields?: ApiFieldErrors,
): AppError {
  return new AppError("CONFLICT", message, { status: 409, fields });
}

/** Fallback message for unexpected, non-AppError failures. */
export const GENERIC_ERROR_MESSAGE =
  "We couldn't complete your request. Please check your connection and try again.";
