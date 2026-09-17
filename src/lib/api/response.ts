import { NextResponse } from "next/server";

import type { ApiErrorCode, ApiFieldErrors, ApiSuccessBody } from "@/types/api";
import { AppError, GENERIC_ERROR_MESSAGE } from "@/lib/errors";
import { logServerError } from "@/lib/log";

/**
 * Server-side helpers that give every route handler the same response shape.
 * Server-only — the client counterpart lives in src/lib/api/client.ts.
 */

export function apiOk<TData>(data: TData, status = 200) {
  const body: ApiSuccessBody<TData> = { ok: true, data };
  return NextResponse.json(body, { status });
}

export function apiFail(
  code: ApiErrorCode,
  message: string,
  status: number,
  fields?: ApiFieldErrors,
  /** Optional correlation id from logServerError (safe to expose). */
  reference?: string,
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
        ...(reference ? { reference } : {}),
      },
    },
    { status },
  );
}

/**
 * Wrap a route handler body. Converts AppError into its envelope, logs
 * unexpected errors with enough context for developers, and returns a
 * generic safe message to the client.
 */
export async function handleApiRequest<TData>(
  operation: () => Promise<TData>,
): Promise<NextResponse> {
  try {
    const data = await operation();
    return apiOk(data);
  } catch (error) {
    if (error instanceof AppError) {
      return apiFail(error.code, error.message, error.status, error.fields);
    }

    // Unexpected error — log it SAFELY (correlation id, error class, one-
    // line sanitized message; never a raw Error object, stack, request
    // body, or credential — §21 logging hygiene) and answer the generic
    // 500 envelope. The id lets an operator grep the server log without
    // exposing internals to the client.
    const errorId = logServerError("api", error);
    return apiFail("INTERNAL", GENERIC_ERROR_MESSAGE, 500, undefined, errorId);
  }
}

/** Safely parse a JSON request body. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid request body.", {
      status: 400,
    });
  }
}
