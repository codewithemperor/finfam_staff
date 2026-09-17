import "server-only";

/**
 * Server-only production configuration validation (production-readiness
 * remediation §6/§7/§19/§30).
 *
 * One small module, deliberately NOT a config framework. It centralises the
 * environment facts that must be TRUE before this application may serve
 * production traffic, and fails FAST and LOUDLY when they are not:
 *
 *   1. Dev OTP echo switches (STAFF_AUTH_DEV_CODE_ECHO /
 *      ADMIN_AUTH_DEV_CODE_ECHO) must never be "true" in production — an
 *      echoed OTP would let anyone sign in as any Staff member or
 *      administrator with only an email address.
 *   2. APP_BASE_URL must be an absolute, valid, HTTPS URL in production —
 *      the canonical origin drives email links and admin CSRF checks. The
 *      http://127.0.0.1:3000 fallback exists ONLY for development.
 *   3. DATABASE_URL must be present in production.
 *   4. NOTIFICATIONS_ENABLED=true requires the Mailjet sender triplet.
 *
 * Development is NEVER affected: unset/`false`/localhost behaviour is
 * byte-identical to the pre-remediation code paths (verified by the
 * existing suite).
 *
 * Enforcement points (defence in depth):
 *   - src/instrumentation.ts calls `assertProductionConfig()` once at
 *     server startup (production only) — a misconfigured deploy fails at
 *     boot with a named error in the process log.
 *   - `resolveAppBaseUrl()` is called at RENDER time by the notification
 *     service, so even a skipped startup check can never emit a
 *     production email containing a http://127.0.0.1:3000 link.
 *   - /api/health reports the masked summary so deploy smoke tests catch
 *     misconfiguration without exposing secret values.
 */

export class ProductionConfigError extends Error {
  readonly variable: string;

  constructor(variable: string, message: string) {
    super(message);
    this.name = "ProductionConfigError";
    this.variable = variable;
  }
}

const DEV_APP_BASE_URL_FALLBACK = "http://127.0.0.1:3000";

/** True only in a real production runtime (the bundled dev/test stack is
 * always NODE_ENV=development, so the automated suite is unaffected). */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function readSwitch(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export interface ProductionConfigSummary {
  /** NODE_ENV=production — the mode the checks below are enforced in. */
  production: boolean;
  /** Dev OTP echo active for ANY domain (must be false in production). */
  devCodeEchoActive: boolean;
  /** APP_BASE_URL is present and parses as an absolute URL. */
  appBaseUrlConfigured: boolean;
  /** APP_BASE_URL is an HTTPS origin (required in production). */
  appBaseUrlSecure: boolean;
  /** NOTIFICATIONS_ENABLED master switch. */
  notificationsEnabled: boolean;
  /** Mailjet API key/secret/sender all present (values never reported). */
  mailjetConfigured: boolean;
}

/** Masked configuration summary for /api/health — never includes secret
 * values, only booleans, so it is safe to expose to a deploy smoke test. */
export function getProductionConfigSummary(): ProductionConfigSummary {
  const rawBaseUrl = process.env.APP_BASE_URL?.trim() ?? "";
  let baseUrlParses = false;
  let baseUrlSecure = false;
  if (rawBaseUrl.length > 0) {
    try {
      const parsed = new URL(rawBaseUrl);
      baseUrlParses = true;
      baseUrlSecure = parsed.protocol === "https:";
    } catch {
      // malformed — reported as unconfigured
    }
  }
  return {
    production: isProduction(),
    devCodeEchoActive:
      readSwitch("STAFF_AUTH_DEV_CODE_ECHO") ||
      readSwitch("ADMIN_AUTH_DEV_CODE_ECHO"),
    appBaseUrlConfigured: baseUrlParses,
    appBaseUrlSecure: baseUrlSecure,
    notificationsEnabled: readSwitch("NOTIFICATIONS_ENABLED"),
    mailjetConfigured:
      (process.env.MAILJET_API_KEY?.trim().length ?? 0) > 0 &&
      (process.env.MAILJET_SECRET_KEY?.trim().length ?? 0) > 0 &&
      (process.env.MAILJET_FROM_EMAIL?.trim().length ?? 0) > 0,
  };
}

/**
 * Resolve the server-authoritative base URL for link building (emails)
 * and origin checks.
 *
 * - Development: unchanged, forgiving behaviour — APP_BASE_URL verbatim
 *   (trailing slashes stripped) or the http://127.0.0.1:3000 fallback.
 * - Production: strict — required, absolute, HTTPS. The only exception is
 *   an EXPLICIT `ALLOW_INSECURE_APP_BASE_URL=true` deployment (a documented,
 *   loud, opt-in escape hatch for isolated test deployments without TLS);
 *   it always prints a warning.
 *
 * Throws ProductionConfigError in production on any violation, so a broken
 * deploy fails loudly instead of emailing links that point at localhost.
 */
export function resolveAppBaseUrl(): string {
  const raw = process.env.APP_BASE_URL?.trim() ?? "";

  if (!isProduction()) {
    return (raw || DEV_APP_BASE_URL_FALLBACK).replace(/\/+$/, "");
  }

  const insecureAllowed = readSwitch("ALLOW_INSECURE_APP_BASE_URL");

  if (!raw) {
    if (insecureAllowed) {
      console.warn(
        "[config] WARNING: APP_BASE_URL is unset in production and " +
          "ALLOW_INSECURE_APP_BASE_URL=true. Emails will contain " +
          `${DEV_APP_BASE_URL_FALLBACK} links. This is NOT acceptable for ` +
          "a real deployment.",
      );
      return DEV_APP_BASE_URL_FALLBACK;
    }
    throw new ProductionConfigError(
      "APP_BASE_URL",
      "APP_BASE_URL is required in production (the canonical HTTPS origin " +
        "used for email links and admin origin checks). Refusing to start " +
        "with the development fallback.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ProductionConfigError(
      "APP_BASE_URL",
      `APP_BASE_URL="${raw}" is not a valid absolute URL (expected e.g. https://portal.example.com).`,
    );
  }

  if (parsed.protocol !== "https:") {
    if (!insecureAllowed) {
      throw new ProductionConfigError(
        "APP_BASE_URL",
        "APP_BASE_URL must be HTTPS in production " +
          `(got "${parsed.protocol}//${parsed.host}"). Set the canonical ` +
          "HTTPS origin, or (isolated test deployments only) explicitly opt " +
          "out with ALLOW_INSECURE_APP_BASE_URL=true.",
      );
    }
    console.warn(
      "[config] WARNING: APP_BASE_URL is non-HTTPS in production and " +
        "ALLOW_INSECURE_APP_BASE_URL=true. Acceptable ONLY for isolated " +
        "test deployments without TLS.",
    );
  }

  return raw.replace(/\/+$/, "");
}

/**
 * Fail-fast startup validation (production only). Called once from
 * src/instrumentation.ts; throws ProductionConfigError on the FIRST
 * violation so the process log names the exact variable to fix.
 */
export function assertProductionConfig(): void {
  if (!isProduction()) return;

  // 1. Dev OTP echo must be OFF in production (remediation §6).
  if (readSwitch("STAFF_AUTH_DEV_CODE_ECHO")) {
    throw new ProductionConfigError(
      "STAFF_AUTH_DEV_CODE_ECHO",
      "Refusing to start: STAFF_AUTH_DEV_CODE_ECHO=true in production " +
        "would return Staff OTPs in HTTP responses. Set it to false.",
    );
  }
  if (readSwitch("ADMIN_AUTH_DEV_CODE_ECHO")) {
    throw new ProductionConfigError(
      "ADMIN_AUTH_DEV_CODE_ECHO",
      "Refusing to start: ADMIN_AUTH_DEV_CODE_ECHO=true in production " +
        "would return Admin OTPs in HTTP responses. Set it to false.",
    );
  }

  // 2. Canonical HTTPS origin (remediation §7) — throws on violation.
  resolveAppBaseUrl();

  // 3. Database URL must be present (remediation §30).
  if (!process.env.DATABASE_URL?.trim()) {
    throw new ProductionConfigError(
      "DATABASE_URL",
      "Refusing to start: DATABASE_URL is required in production.",
    );
  }

  // 4. Mailjet triplet required when notifications are enabled (§30).
  const summary = getProductionConfigSummary();
  if (summary.notificationsEnabled && !summary.mailjetConfigured) {
    throw new ProductionConfigError(
      "MAILJET_API_KEY",
      "Refusing to start: NOTIFICATIONS_ENABLED=true requires " +
        "MAILJET_API_KEY, MAILJET_SECRET_KEY and MAILJET_FROM_EMAIL " +
        "(a validated sender) in production.",
    );
  }
}
