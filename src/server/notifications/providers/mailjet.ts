import "server-only";

/**
 * Mailjet adapter — the ONLY file in the project that knows the Mailjet
 * wire format (brief §3/§6). Uses the transactional Send API v3.1
 * (POST https://api.mailjet.com/v3.1/send) with server-side HTTP Basic
 * authentication and native fetch — no SDK dependency.
 *
 * Guarantees:
 * - Credentials are read from server-only environment variables at call
 *   time and NEVER appear in results, logs or error messages.
 * - Responses are mapped to a small safe result type: error codes are
 *   status/transport classes, never provider bodies.
 * - The fetch implementation is injectable so the adapter is unit-testable
 *   without production credentials (brief §27).
 */

export const MAILJET_SEND_API_URL = "https://api.mailjet.com/v3.1/send";

/** One outgoing transactional email, provider-neutral. */
export interface OutgoingEmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Traceable id echoed to the provider (our dedupe key). */
  customId?: string;
}

export interface MailjetAdapterOptions {
  apiKey?: string;
  secretKey?: string;
  fromEmail?: string;
  fromName?: string;
  /** Full send endpoint; defaults to the production v3.1 send URL. */
  url?: string;
  timeoutMs?: number;
  /** Injectable transport for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * The v3.1 response subset we consume. MessageID arrives as a large number.
 */
interface MailjetV31Response {
  Messages?: Array<{
    Status?: string;
    To?: Array<{ MessageID?: number | string; MessageGUID?: string }>;
  }>;
}

export type MailjetSendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; errorCode: string; errorMessage: string };

interface MailjetMessageBody {
  From: { Email: string; Name: string };
  To: Array<{ Email: string }>;
  Subject: string;
  TextPart: string;
  HTMLPart: string;
  CustomID?: string;
}

/**
 * Build the v3.1 request body for one message. Pure function — exported for
 * tests (From/To/Subject/Text/HTML/CustomID placement).
 */
export function buildMailjetMessage(
  message: OutgoingEmailMessage,
  sender: { fromEmail: string; fromName: string },
): MailjetMessageBody {
  const body: MailjetMessageBody = {
    From: { Email: sender.fromEmail, Name: sender.fromName },
    To: [{ Email: message.to }],
    Subject: message.subject,
    TextPart: message.text,
    HTMLPart: message.html,
  };
  if (message.customId) {
    body.CustomID = message.customId;
  }
  return body;
}

function transportFailure(
  error: unknown,
): { ok: false; errorCode: string; errorMessage: string } {
  if (error instanceof Error && error.name === "AbortError") {
    return {
      ok: false,
      errorCode: "TIMEOUT",
      errorMessage: "The email service did not respond in time.",
    };
  }
  return {
    ok: false,
    errorCode: "NETWORK_ERROR",
    errorMessage: "The email service could not be reached.",
  };
}

/**
 * Send one message via Mailjet. Reads credentials/URL/timeout from the
 * environment when not overridden — always at CALL time so tests and
 * workers can reconfigure without a module reload.
 */
export async function sendViaMailjet(
  message: OutgoingEmailMessage,
  options: MailjetAdapterOptions = {},
): Promise<MailjetSendResult> {
  const apiKey = (options.apiKey ?? process.env.MAILJET_API_KEY ?? "").trim();
  const secretKey = (
    options.secretKey ?? process.env.MAILJET_SECRET_KEY ?? ""
  ).trim();
  const fromEmail = (
    options.fromEmail ?? process.env.MAILJET_FROM_EMAIL ?? ""
  ).trim();
  const fromName = (
    options.fromName ?? process.env.MAILJET_FROM_NAME ?? "FinFam Recruitment"
  ).trim();
  const url = (
    options.url ?? process.env.MAILJET_API_URL ?? MAILJET_SEND_API_URL
  ).trim();
  const timeoutMs =
    options.timeoutMs ??
    (Number.parseInt(process.env.NOTIFICATIONS_SEND_TIMEOUT_MS ?? "", 10) ||
      10_000);
  const fetchImpl = options.fetchImpl ?? fetch;

  const body = buildMailjetMessage(message, { fromEmail, fromName });

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        // HTTP Basic per Mailjet Send API — server-side only.
        authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString("base64")}`,
        "content-type": "application/json",
      },
      // Mailjet Send API v3.1 requires every message inside a top-level
      // `Messages` array, even when sending one message.
      body: JSON.stringify({ Messages: [body] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return transportFailure(error);
  }

  if (!response.ok) {
    // Never echo the provider body — it may reflect internal details.
    return {
      ok: false,
      errorCode: `HTTP_${response.status}`,
      errorMessage: "The email provider rejected the request.",
    };
  }

  let parsed: MailjetV31Response;
  try {
    parsed = (await response.json()) as MailjetV31Response;
  } catch {
    return {
      ok: false,
      errorCode: "PROVIDER_RESPONSE_INVALID",
      errorMessage: "The email provider returned an unreadable response.",
    };
  }

  const messages = parsed.Messages ?? [];
  if (messages.length === 0 || messages.some((m) => m.Status !== "success")) {
    return {
      ok: false,
      errorCode: "PROVIDER_REJECTED",
      errorMessage: "The email provider did not accept the message.",
    };
  }

  const firstMessageId = messages[0]?.To?.[0]?.MessageID;
  return {
    ok: true,
    messageId:
      firstMessageId === undefined || firstMessageId === null
        ? null
        : String(firstMessageId),
  };
}
