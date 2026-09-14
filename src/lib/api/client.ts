import type {
  ApiErrorBody,
  ApiFieldErrors,
  ApiResponseBody,
} from "@/types/api";

/**
 * Browser-side fetch helper. Unwraps the standard API envelope and turns
 * failures into ApiClientError so forms can show field-level errors and
 * human-readable messages.
 */
export class ApiClientError extends Error {
  readonly code: ApiErrorBody["error"]["code"];
  readonly status: number;
  readonly fields?: ApiFieldErrors;

  constructor(
    code: ApiClientError["code"],
    message: string,
    status: number,
    fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

const NETWORK_ERROR_MESSAGE =
  "We couldn't reach the server. Please check your connection and try again.";

export async function apiFetch<TData>(
  input: string,
  init?: RequestInit,
): Promise<TData> {
  let response: Response;

  try {
    response = await fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiClientError("INTERNAL", NETWORK_ERROR_MESSAGE, 0);
  }

  let body: ApiResponseBody<TData> | undefined;
  try {
    body = (await response.json()) as ApiResponseBody<TData>;
  } catch {
    // Non-JSON response (e.g. proxy error page)
    throw new ApiClientError(
      "INTERNAL",
      "The server returned an unexpected response. Please try again.",
      response.status,
    );
  }

  if (!response.ok || !body || body.ok !== true) {
    const errorBody = body && body.ok === false ? body : undefined;
    throw new ApiClientError(
      errorBody?.error.code ?? "INTERNAL",
      errorBody?.error.message ??
        "Something went wrong while completing your request. Please try again.",
      response.status,
      errorBody?.error.fields,
    );
  }

  return body.data;
}
