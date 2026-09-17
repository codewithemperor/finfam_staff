import { z } from "zod";

/**
 * Admin console validation (Stage 11).
 *
 * The schema is re-run on the server for every request — the server never
 * trusts the client. Deliberately NO adminId / actorId / role / permission
 * field exists anywhere: the audit actor and the authorization identity are
 * resolved from the Admin session only (approved brief §36/§43), and the
 * StaffAccount target is expressed as intent-specific endpoints, never a
 * generic PATCH body.
 *
 * Search/filter allowlist (brief §19): the directory accepts exactly
 * `q`, `status` and `page` — no arbitrary field names, no sort expressions.
 */

/* ── Admin auth (mirrors staff-auth schemas — reuse would couple the two
 * domains' error copy; the admin copy says "sign-in code") ── */

/** Body of POST /api/admin/auth/request-code. */
export const adminRequestCodeSchema = z.object({
  email: z
    .string({ message: "Enter your administrator email address." })
    .trim()
    .min(3, "Enter your administrator email address.")
    .max(254, "Enter your administrator email address.")
    .email("Enter a valid email address."),
});

export type AdminRequestCodeInput = z.infer<typeof adminRequestCodeSchema>;

/** Body of POST /api/admin/auth/verify. */
export const adminVerifyCodeSchema = z.object({
  email: z
    .string({ message: "Enter your administrator email address." })
    .trim()
    .min(3, "Enter your administrator email address.")
    .max(254, "Enter your administrator email address.")
    .email("Enter a valid email address."),
  code: z
    .string({ message: "Enter the 6-digit sign-in code." })
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit sign-in code from your email."),
});

export type AdminVerifyCodeInput = z.infer<typeof adminVerifyCodeSchema>;

/* ── Staff directory query (GET /api/admin/staff, brief §19) ── */

export const adminDirectoryStatusSchema = z.enum(["ALL", "ACTIVE", "SUSPENDED"]);

export const adminStaffListQuerySchema = z.object({
  /** Whitelisted free-text search: Staff ID, name or email. */
  q: z
    .string()
    .trim()
    .max(100, "Search terms must be 100 characters or fewer.")
    .optional(),
  status: adminDirectoryStatusSchema.default("ALL"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type AdminStaffListQuery = z.infer<typeof adminStaffListQuerySchema>;

/* ── Privileged account actions (brief §27/§31) ── */

const MAX_REASON_LENGTH = 500;

/** Body of POST /api/admin/staff/[id]/suspend — reason is REQUIRED. */
export const adminSuspendSchema = z.object({
  reason: z
    .string({ message: "A suspension reason is required." })
    .trim()
    .min(1, "A suspension reason is required.")
    .max(
      MAX_REASON_LENGTH,
      `The reason must be ${MAX_REASON_LENGTH} characters or fewer.`,
    ),
});

export type AdminSuspendInput = z.infer<typeof adminSuspendSchema>;

/** Body of POST /api/admin/staff/[id]/reactivate — note is optional. */
export const adminReactivateSchema = z.object({
  note: z
    .string()
    .trim()
    .max(
      MAX_REASON_LENGTH,
      `The note must be ${MAX_REASON_LENGTH} characters or fewer.`,
    )
    .optional(),
});

export type AdminReactivateInput = z.infer<typeof adminReactivateSchema>;

/* ── Admin daily reports query (GET /api/admin/reports, brief §24) ── */

export const adminReportListQuerySchema = z.object({
  /** "YYYY-MM-DD" month filter, Africa/Lagos calendar semantics. */
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Use the YYYY-MM month format.")
    .optional(),
  /** Whitelisted staff search: Staff ID or staff name. */
  staff: z
    .string()
    .trim()
    .max(100, "Search terms must be 100 characters or fewer.")
    .optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type AdminReportListQuery = z.infer<typeof adminReportListQuerySchema>;

/* ── Admin audit query (GET /api/admin/audit) ── */

export const adminAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;
