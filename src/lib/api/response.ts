import { NextResponse } from "next/server";

import type { ApiErrorCode, ApiFieldErrors, ApiSuccessBody } from "@/types/api";
import { AppError, GENERIC_ERROR_MESSAGE } from "@/lib/errors";

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
) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(fields ? { fields } : {}) } },
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

    // Unexpected error — log for developers, never expose internals.
    console.error("[api] Unhandled error:", error);
    return apiFail("INTERNAL", GENERIC_ERROR_MESSAGE, 500);
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
