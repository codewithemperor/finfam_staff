/**
 * Next.js instrumentation hook — runs ONCE per server process start.
 *
 * Production-readiness remediation (§6/§7/§30): in production the process
 * fails FAST and LOUDLY at boot when a deployment-critical environment
 * variable is missing or unsafe (dev OTP echo on, non-HTTPS APP_BASE_URL,
 * missing DATABASE_URL, notifications enabled without Mailjet credentials).
 *
 * Development is untouched — assertProductionConfig() returns immediately
 * when NODE_ENV !== "production", so the sandbox/dev/test behaviour is
 * byte-identical to before.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertProductionConfig } = await import(
    "@/server/config/production"
  );
  assertProductionConfig();
}
