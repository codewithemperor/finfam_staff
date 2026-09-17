import "server-only";

import {
  type NotificationPayloadMap,
  type NotificationTypeId,
} from "./notification-types";
import {
  formatLagosDateLabel,
  formatLagosDateTimeLabel,
  toLagosDateString,
} from "@/lib/dates/lagos";

/**
 * Code-owned transactional email templates (brief §17/§18).
 *
 * Every template renders strictly from its typed payload — no database
 * access, no ambient state — so renders are reproducible and testable.
 * Each email answers the four content questions (§20): what happened, what
 * it means, what to do next, and where to safely continue.
 *
 * Design (§19): white background, dark neutral text, the restrained FinFam
 * green for the heading accent and one CTA — no gradients, no banners, no
 * marketing hype. Transactional email, not a newsletter.
 *
 * All payload strings are HTML-escaped in the HTML part (names are user
 * input); the text part is plain by construction. Date labels are rendered
 * through the Africa/Lagos helpers — never the host machine's timezone.
 */

/** Version stored on every NotificationDelivery row at enqueue time. */
// v2.2 (Stage 11): registry gained ADMIN_LOGIN_CODE (one-shot admin OTP)
// plus a recipient-aware footer — no existing template's wording changed.
export const NOTIFICATION_TEMPLATE_VERSION = "2.2";

/** FinFam accent green — single source: src/app/globals.css --accent. */
const ACCENT = "#0c7a43";
const TEXT = "#18181b";
const MUTED = "#52525b";
const BORDER = "#e4e4e7";

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface SafeLink {
  label: string;
  /** App-relative path — resolved against APP_BASE_URL server-side (§21). */
  path: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  return first.length > 0 ? first : "there";
}

/** Shared HTML shell: one column, quiet footer, inline styles only. */
function renderHtml(options: {
  heading: string;
  paragraphs: string[];
  callout?: { label: string; value: string };
  link?: SafeLink;
  baseUrl: string;
  /** Recruitment/Staff framing. Admin one-shots (Stage 11) omit it — the
   * footer then uses a neutral administrator wording (§9). */
  referenceNumber?: string;
}): string {
  const { heading, paragraphs, callout, link, baseUrl, referenceNumber } =
    options;

  const bodyHtml = paragraphs
    .map((paragraph) =>
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${TEXT};">${paragraph}</p>`,
    )
    .join("");

  const calloutHtml = callout
    ? `<div style="margin:20px 0;padding:14px 18px;border:1px solid ${BORDER};border-left:3px solid ${ACCENT};border-radius:6px;background:#fafafa;">
        <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};margin-bottom:4px;">${escapeHtml(callout.label)}</div>
        <div style="font-size:19px;font-weight:700;color:${TEXT};letter-spacing:0.02em;">${escapeHtml(callout.value)}</div>
      </div>`
    : "";

  const ctaHtml = link
    ? `<div style="margin:24px 0 8px;">
        <a href="${escapeHtml(`${baseUrl}${link.path}`)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:6px;">${escapeHtml(link.label)}</a>
      </div>
      <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:${MUTED};">Or copy this link into your browser:<br /><span style="color:${TEXT};">${escapeHtml(`${baseUrl}${link.path}`)}</span></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f4f5;">
  <div style="padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${BORDER};border-radius:10px;padding:36px 36px 28px;">
      <div style="font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${ACCENT};margin-bottom:22px;">FinFam</div>
      <h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:700;color:${TEXT};">${escapeHtml(heading)}</h1>
      ${bodyHtml}
      ${calloutHtml}
      ${ctaHtml}
    </div>
    <div style="max-width:560px;margin:14px auto 0;padding:0 8px;">
      <p style="margin:0;font-size:11px;line-height:1.6;color:${MUTED};">${
        referenceNumber
          ? `You are receiving this email because of activity on FinFam application ${escapeHtml(referenceNumber)}. The application portal is the authoritative source for your current status.`
          : "You are receiving this email because of sign-in activity for a FinFam administrator account. If you did not request this code, you can safely ignore this email."
      }</p>
    </div>
  </div>
</body>
</html>`;
}

function renderText(options: {
  heading: string;
  paragraphs: string[];
  callout?: { label: string; value: string };
  link?: SafeLink;
  baseUrl: string;
  /** Recruitment/Staff framing — omitted for admin one-shots (§9). */
  referenceNumber?: string;
}): string {
  const { heading, paragraphs, callout, link, baseUrl, referenceNumber } =
    options;
  const lines: string[] = [heading, ""];
  for (const paragraph of paragraphs) {
    // Strip the tiny amount of inline markup the text templates use.
    lines.push(paragraph.replace(/<[^>]+>/g, ""), "");
  }
  if (callout) {
    lines.push(`${callout.label}: ${callout.value}`, "");
  }
  if (link) {
    lines.push(`${link.label}:`, `${baseUrl}${link.path}`, "");
  }
  lines.push(
    referenceNumber
      ? `FinFam · Application reference ${referenceNumber}`
      : "FinFam · Administrator sign-in",
    referenceNumber
      ? "The application portal is the authoritative source for your current status."
      : "If you did not request this code, you can safely ignore this email.",
    "",
  );
  return lines.join("\n").trimEnd();
}

function render(options: {
  subject: string;
  heading: string;
  paragraphs: string[];
  callout?: { label: string; value: string };
  link?: SafeLink;
  baseUrl: string;
  /** Recruitment/Staff framing — omitted for admin one-shots (§9). */
  referenceNumber?: string;
}): RenderedEmail {
  return {
    subject: options.subject,
    text: renderText(options),
    html: renderHtml(options),
  };
}

/**
 * Per-type renderers. The mapped table keeps payload typing correlated with
 * the notification key — each renderer receives ITS payload type, so no
 * casts are needed anywhere in this file.
 */
type NotificationRenderers = {
  [T in NotificationTypeId]: (
    payload: NotificationPayloadMap[T],
    context: { baseUrl: string; name: string; journeyPath: string },
  ) => RenderedEmail;
};

const RENDERERS: NotificationRenderers = {
  APPLICATION_RECEIVED: (payload, { baseUrl, name, journeyPath }) =>
    render({
      subject: "Your FinFam application has been received",
      heading: `Thank you, ${name} — your application has been received.`,
      paragraphs: [
        `Your application for the <strong>${escapeHtml(payload.roleTitle)}</strong> role is now in our system and your recruitment journey has begun.`,
        "Keep this reference safe — you can use it, together with your email address, to continue your application at any time. The next step is the FinFam Staff Orientation Workshop, which you can start right away.",
      ],
      callout: { label: "Application reference", value: payload.referenceNumber },
      link: { label: "Continue application", path: journeyPath },
      baseUrl,
      referenceNumber: payload.referenceNumber,
    }),
  ORIENTATION_COMPLETED: (payload, { baseUrl, name, journeyPath }) =>
    render({
      subject: "Orientation complete — the assessment is next",
      heading: `Well done, ${name} — your orientation is complete.`,
      paragraphs: [
        "You have finished the FinFam Staff Orientation Workshop and confirmed the integrity acknowledgement.",
        "The next step is the automated interview assessment. It is timed per attempt, scored automatically, and you can continue it later if you need to stop.",
      ],
      link: { label: "Continue application", path: journeyPath },
      baseUrl,
      referenceNumber: payload.referenceNumber,
    }),

  ASSESSMENT_PASSED: (payload, { baseUrl, name, journeyPath }) =>
    render({
      subject: "You passed the FinFam assessment",
      heading: `Congratulations, ${name} — you passed the assessment.`,
      paragraphs: [
        `You scored <strong>${Math.round(payload.percentage)}%</strong> on attempt ${payload.attemptNumber}.`,
        "The next step is the Responsibility &amp; Reward Agreement. Please read it carefully before you accept — your acceptance is recorded against its exact version.",
      ],
      link: { label: "Continue application", path: journeyPath },
      baseUrl,
      referenceNumber: payload.referenceNumber,
    }),

  ASSESSMENT_FAILED: (payload, { baseUrl, name, journeyPath }) => {
    const retryParagraph = payload.retakeAllowed
      ? "Under the current policy you may retake the assessment. Your new attempt starts fresh and is scored in the same way."
      : "Under the current policy no retake is available. If this changes, we will contact you — you do not need to re-apply.";
    return render({
      subject: "Your FinFam assessment result",
      heading: `Your assessment result, ${name}.`,
      paragraphs: [
        `Attempt ${payload.attemptNumber} scored <strong>${Math.round(payload.percentage)}%</strong>, which is below the pass mark. Your application status has been updated honestly — it has not been withdrawn.`,
        retryParagraph,
        "For fairness, individual questions and answers are not shared.",
      ],
      link: { label: "View your application", path: journeyPath },
      baseUrl,
      referenceNumber: payload.referenceNumber,
    });
  },

  AGREEMENT_ACCEPTED: (payload, { baseUrl, name, journeyPath }) =>
    render({
      subject: "Agreement accepted — your provisional appointment is next",
      heading: `Thank you, ${name} — your acceptance has been recorded.`,
      paragraphs: [
        `Your acceptance of the Responsibility &amp; Reward Agreement (version ${escapeHtml(payload.agreementVersion)}) has been recorded on your application.`,
        "The next step is your provisional letter of appointment, which is issued to you in the portal.",
      ],
      link: { label: "Continue application", path: journeyPath },
      baseUrl,
      referenceNumber: payload.referenceNumber,
    }),

  APPOINTMENT_ISSUED: (payload, { baseUrl, name }) =>
    render({
      subject: "Your FinFam provisional appointment",
      heading: `${name}, your provisional letter of appointment has been issued.`,
      paragraphs: [
        `Your provisional appointment as <strong>${escapeHtml(payload.designation)}</strong> was issued on ${escapeHtml(formatLagosDateLabel(toLagosDateString(new Date(payload.issuedAt))))}. The full letter, including its terms, is available in the portal.`,
        "Please review it carefully. Staff activation follows the appointment.",
      ],
      callout: { label: "Appointment reference", value: payload.appointmentReference },
      link: { label: "View your appointment", path: `/appointment/${payload.referenceNumber}` },
      baseUrl,
      referenceNumber: payload.referenceNumber,
    }),

  STAFF_ACTIVATED: (payload, { baseUrl, name, journeyPath }) =>
    render({
      subject: "Welcome to FinFam — your Staff ID",
      heading: `${name}, your FinFam staff profile is active.`,
      paragraphs: [
        "Your recruitment journey is complete and your staff profile has been activated.",
        "The final step is staff onboarding — a short set of briefings on communication, reporting and professional expectations. You can complete it in one sitting or return to it later; the portal remembers where you stopped.",
      ],
      callout: { label: "Your Staff ID", value: payload.staffId },
      link: { label: "Continue application", path: journeyPath },
      baseUrl,
      referenceNumber: payload.referenceNumber,
    }),

  ONBOARDING_STARTED: (payload, { baseUrl, name }) =>
    render({
      subject: "Your FinFam onboarding has started",
      heading: `${name}, your onboarding has started.`,
      paragraphs: [
        "You have opened the FinFam staff onboarding for your role. It walks through communication, customer support, reporting and professional standards, and ends with one short acknowledgement.",
        "You can return later at any time — nothing is lost between visits. No email is sent for individual steps; we will only write again when onboarding is complete.",
      ],
      link: { label: "Continue onboarding", path: `/onboarding/${payload.referenceNumber}` },
      baseUrl,
      referenceNumber: payload.referenceNumber,
    }),

  ONBOARDING_COMPLETED: (payload, { baseUrl, name }) =>
    render({
      subject: "You are now a FinFam staff member",
      heading: `${name}, you are now a FinFam staff member.`,
      paragraphs: [
        "Your Staff Onboarding is complete and your recruitment application is now closed. Your FinFam staff profile is ready.",
        "Open the Staff Portal with your registered email address and request a secure one-time login code. The code will be sent to this email address.",
      ],
      callout: { label: "Staff ID", value: payload.staffId },
      link: { label: "Open the Staff Portal", path: "/staff/login" },
      baseUrl,
      referenceNumber: payload.referenceNumber,
    }),

  STAFF_ACCOUNT_CREATED: (payload, { baseUrl, name }) =>
    // Stage 7 (approved): portal access is ready. Focused ONLY on the
    // portal + how to sign in (brief §45) — recruitment results and the
    // Staff ID assignment stay in the STAFF_ACTIVATED email. Login uses a
    // secure email code; no password or reusable credential ever exists.
    render({
      subject: "Your FinFam Staff Portal is ready",
      heading: `${name}, your FinFam Staff Portal is ready.`,
      paragraphs: [
        "Your Staff Portal account has been created, giving you secure access to the FinFam Staff Portal.",
        "Signing in uses a secure login code sent to this email address — there is no password. Once signed in, you can complete your onboarding and resumption instructions inside the portal.",
      ],
      callout: { label: "Staff ID", value: payload.staffId },
      link: { label: "Open the Staff Portal", path: "/staff/login" },
      baseUrl,
      referenceNumber: payload.referenceNumber,
    }),

  STAFF_LOGIN_CODE: (payload, { baseUrl, name }) =>
    // Stage 7 OTP email (brief §9): ONLY FinFam context, the six-digit
    // code, expiry information and a security note. No financial data, no
    // documents, no credentials, no links besides the neutral sign-in page.
    render({
      subject: "Your FinFam Staff Portal login code",
      heading: `${name}, your FinFam login code.`,
      paragraphs: [
        "Enter this code on the FinFam Staff Portal sign-in page to continue.",
        "This code expires 10 minutes after it was sent and can be used once. If you did not request it, you can safely ignore this email — no one can sign in without it.",
      ],
      callout: { label: "Login code", value: payload.loginCode },
      link: { label: "Open the Staff Portal sign-in", path: "/staff/login" },
      baseUrl,
      referenceNumber: payload.referenceNumber,
    }),

  DAILY_REPORT_SUBMITTED: (payload, { baseUrl, name }) =>
    // Stage 8 receipt (approved §25): a durable, concise confirmation that
    // the daily report was accepted — report date + received-when. NO
    // metrics digest (the portal is the authoritative view), and never a
    // reminder (no deadline policy exists).
    render({
      subject: "Your FinFam daily report has been received",
      heading: `${name}, your daily report has been received.`,
      paragraphs: [
        `Your daily activity report for <strong>${escapeHtml(formatLagosDateLabel(payload.reportDate))}</strong> was received on ${escapeHtml(formatLagosDateTimeLabel(new Date(payload.submittedAt)))} (Africa/Lagos).`,
        "Thank you for reporting your activity accurately. You can review your submitted reports in the Staff Portal at any time.",
      ],
      callout: {
        label: "Report date",
        value: formatLagosDateLabel(payload.reportDate),
      },
      link: { label: "Open Daily Reports", path: "/staff/reports" },
      baseUrl,
      referenceNumber: payload.referenceNumber,
    }),

  ADMIN_LOGIN_CODE: (payload, { baseUrl }) =>
    // Stage 11 admin OTP email (approved brief §9): neutral anti-enumeration
    // copy, the six-digit code, expiry information and a security note. It
    // NEVER reveals whether the address holds an AdminAccount, carries no
    // candidate/recruitment framing (administrators have none), and links
    // only to the admin sign-in page.
    render({
      subject: "Your FinFam Admin sign-in code",
      heading: "Your FinFam Admin sign-in code.",
      paragraphs: [
        "If this email belongs to an authorized FinFam administrator account, use the code below to sign in.",
        "This code expires 10 minutes after it was sent and can be used once. If you did not request it, you can safely ignore this email — no one can sign in without it.",
      ],
      callout: { label: "Sign-in code", value: payload.loginCode },
      link: { label: "Open FinFam Admin", path: "/admin/login" },
      baseUrl,
    }),
};

/**
 * Render one lifecycle email. Every renderer keeps to the brief's per-type
 * content rules — honest status, no invented promises, no answer keys,
 * no Staff Portal claims before Stage 7 exists.
 */
export function renderNotificationEmail<T extends NotificationTypeId>(
  type: T,
  payload: NotificationPayloadMap[T],
  baseUrl: string,
): RenderedEmail {
  // RAW first name — the HTML shell escapes the composed heading exactly
  // once, so payloads can never slip through unescaped NOR be double-escaped.
  // Stage 11: admin one-shot payloads carry NO candidate identity — the
  // admin renderer ignores name/journeyPath and the shell drops the
  // application footer, so existing renderers are untouched.
  const candidateName = (payload as { candidateName?: unknown }).candidateName;
  const referenceNumber = (payload as { referenceNumber?: unknown })
    .referenceNumber;
  const name = typeof candidateName === "string" ? firstName(candidateName) : "";
  const journeyPath =
    typeof referenceNumber === "string"
      ? `/application/${referenceNumber}`
      : "";
  return RENDERERS[type](payload, { baseUrl, name, journeyPath });
}
