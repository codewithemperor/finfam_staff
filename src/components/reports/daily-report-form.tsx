"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  FieldError,
  Input,
  Label,
  Spinner,
  toast,
} from "@heroui/react";

import { DailyReportReview } from "@/components/reports/daily-report-review";
import { Textarea } from "@/components/ui/textarea";
import {
  DAILY_REPORT_CATEGORIES,
  DAILY_REPORT_MAX_COUNT,
  DAILY_REPORT_SELF_REPORTED_NOTICE,
  DAILY_REPORT_SUMMARY_MAX_LENGTH,
} from "@/config/daily-report";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { DailyReportView } from "@/types/staff-reports";

/**
 * The Daily Report editor (Stage 8).
 *
 * The nine approved metrics render as four labelled fieldsets in the
 * official onboarding order; every field shows its approved meaning as
 * visible helper copy. Editing rules (brief §12): whole numbers 0–999,
 * NEVER silently clamped — out-of-range or non-numeric input is rejected
 * with a per-field error, on the client and again on the server. An
 * emptied count field saves as 0 (an all-zero report is valid).
 *
 * Two actions: "Save draft" (full-replace PATCH, report stays editable)
 * and "Review & submit" (focused review modal → one-way POST submit).
 * Submission is permanent — the server, not this component, is the
 * authority, and after a successful submit the read-only detail view
 * replaces the editor.
 *
 * Accessibility: native fieldset/legend per category, labelled inputs with
 * aria-invalid + FieldError, role="alert" form errors, numeric keypads via
 * inputMode, and a sticky (in-flow, never content-covering) action bar on
 * small screens.
 */

const COUNT_ERROR = "Enter a whole number between 0 and 999.";

/** A metric value as typed — raw string state, validated, never clamped. */
type MetricValues = Record<string, string>;

function initialValues(report: DailyReportView): MetricValues {
  const values: MetricValues = {};
  for (const category of DAILY_REPORT_CATEGORIES) {
    for (const field of category.fields) {
      values[field.name] = String(report.metrics[field.name] ?? 0);
    }
  }
  return values;
}

/**
 * Resolve ONE raw input to either a valid count or an error. An emptied
 * field resolves to 0; anything non-numeric, negative, fractional or over
 * 999 is an error (visible, never auto-corrected).
 */
function resolveCount(raw: string): { value: number; error: string | null } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: 0, error: null };
  if (!/^\d+$/.test(trimmed)) return { value: 0, error: COUNT_ERROR };
  const value = Number(trimmed);
  if (value > DAILY_REPORT_MAX_COUNT) {
    return { value: 0, error: `Enter a whole number between 0 and ${DAILY_REPORT_MAX_COUNT}.` };
  }
  return { value, error: null };
}

export function DailyReportForm({
  report,
  reportDateLabel,
}: {
  report: DailyReportView;
  /** Preformatted Africa/Lagos label of report.reportDate (server-rendered). */
  reportDateLabel: string;
}) {
  const router = useRouter();

  const [values, setValues] = useState<MetricValues>(() =>
    initialValues(report),
  );
  const [summary, setSummary] = useState(report.activitySummary ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** Validate everything; returns the resolved payload or null (errors set). */
  const validate = useMemo(() => {
    return (): {
      metrics: Record<string, number>;
      activitySummary: string | null;
    } | null => {
      const errors: Record<string, string> = {};
      const metrics: Record<string, number> = {};
      for (const category of DAILY_REPORT_CATEGORIES) {
        for (const field of category.fields) {
          const resolved = resolveCount(values[field.name] ?? "");
          if (resolved.error) errors[field.name] = resolved.error;
          else metrics[field.name] = resolved.value;
        }
      }
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        setFormError(
          "Fix the highlighted fields before saving or submitting.",
        );
        return null;
      }
      setFormError(null);
      return {
        metrics,
        activitySummary:
          summary.trim().length > 0 ? summary.trim() : null,
      };
    };
  }, [values, summary]);

  async function handleSave(event?: React.FormEvent) {
    event?.preventDefault();
    if (saving || submitting) return;

    const payload = validate();
    if (!payload) return;

    setSaving(true);
    try {
      await apiFetch<DailyReportView>(`/api/staff/reports/${report.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...payload.metrics, activitySummary: payload.activitySummary ?? undefined }),
      });
      toast("Draft saved.", {
        description: "Your report for this date is saved as a draft.",
        variant: "success",
      });
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fields) {
          setFieldErrors(error.fields);
          setFormError(error.message);
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError(
          "We couldn't save your report. Please check your connection and try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function handleReviewOpen() {
    const payload = validate();
    if (!payload) return;
    setSubmitError(null);
    setReviewOpen(true);
  }

  async function handleSubmit() {
    if (submitting || saving) return;

    // Re-validate: the review modal can only open with valid values, but
    // the server re-checks everything anyway (defense in depth).
    const payload = validate();
    if (!payload) {
      setReviewOpen(false);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Save the reviewed values, then finalise — one review = the exact
      // values that are submitted.
      await apiFetch<DailyReportView>(`/api/staff/reports/${report.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...payload.metrics, activitySummary: payload.activitySummary ?? undefined }),
      });
      await apiFetch<{ report: DailyReportView; alreadySubmitted: boolean }>(
        `/api/staff/reports/${report.id}/submit`,
        { method: "POST" },
      );
      setReviewOpen(false);
      toast("Daily report submitted.", {
        description: "Your report for this date is now final and read-only.",
        variant: "success",
      });
      router.push(`/staff/reports/${report.id}`);
      router.refresh();
    } catch (error) {
      let message =
        "We couldn't submit your report. Please check your connection and try again.";
      if (error instanceof ApiClientError) {
        message = error.message;
        if (error.fields) setFieldErrors(error.fields);
        if (error.code === "CONFLICT") {
          // Someone finalised it first — show the authoritative state.
          setReviewOpen(false);
          router.refresh();
        }
      }
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form noValidate onSubmit={handleSave} className="flex flex-col gap-6">
        <div aria-live="polite" className="sr-only">
          {formError ?? ""}
        </div>

        {DAILY_REPORT_CATEGORIES.map((category) => (
          <fieldset
            key={category.id}
            className="rounded-lg border border-border bg-surface p-4 sm:p-5"
          >
            <legend className="px-1 text-sm font-semibold text-foreground">
              {category.legend}
            </legend>
            <div className="mt-1 grid gap-4 sm:grid-cols-2">
              {category.fields.map((field) => {
                const error = fieldErrors[field.name];
                const describedBy = error
                  ? `${category.id}-${field.name}-helper ${category.id}-${field.name}-error`
                  : `${category.id}-${field.name}-helper`;
                return (
                  <div
                    key={field.name}
                    className={field.helper.length > 60 ? "sm:col-span-2" : ""}
                  >
                    <Label
                      htmlFor={`metric-${field.name}`}
                      className="text-sm font-medium text-foreground"
                    >
                      {field.label}
                    </Label>
                    <Input
                      id={`metric-${field.name}`}
                      name={field.name}
                      className="mt-1.5 w-full max-w-40"
                      value={values[field.name] ?? ""}
                      onChange={(event) => {
                        setValues((previous) => ({
                          ...previous,
                          [field.name]: event.target.value,
                        }));
                        setFieldErrors((previous) => {
                          if (!previous[field.name]) return previous;
                          const next = { ...previous };
                          delete next[field.name];
                          return next;
                        });
                      }}
                      inputMode="numeric"
                      pattern="\d*"
                      autoComplete="off"
                      aria-invalid={Boolean(error) || undefined}
                      aria-describedby={describedBy}
                    />
                    <p
                      id={`${category.id}-${field.name}-helper`}
                      className="mt-1.5 text-xs leading-5 text-muted-foreground"
                    >
                      {field.helper}
                    </p>
                    {error && (
                      <p
                        id={`${category.id}-${field.name}-error`}
                        role="alert"
                        className="mt-1 text-xs font-medium text-danger"
                      >
                        {error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
          <Label
            htmlFor="daily-report-summary"
            className="text-sm font-medium text-foreground"
          >
            Activity summary
          </Label>
          <Textarea
            id="daily-report-summary"
            name="activitySummary"
            className="mt-1.5"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={4}
            maxLength={DAILY_REPORT_SUMMARY_MAX_LENGTH}
            aria-describedby="daily-report-summary-helper"
          />
          <p
            id="daily-report-summary-helper"
            className="mt-1.5 text-xs leading-5 text-muted-foreground"
          >
            Optional — anything the counts cannot capture, plain text only;
            do not include anyone&apos;s personal details.{" "}
            {summary.trim().length}/{DAILY_REPORT_SUMMARY_MAX_LENGTH}{" "}
            characters.
          </p>
        </div>

        {formError && (
          <p role="alert" className="text-sm font-medium text-danger">
            {formError}
          </p>
        )}

        {/* Sticky (in-flow) action bar — never covers content; respects
            the iOS safe area. */}
        <div className="sticky bottom-0 -mx-4 mt-2 border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="submit"
              variant="outline"
              isPending={saving}
              isDisabled={submitting}
            >
              {({ isPending }) => (
                <>
                  {isPending && <Spinner color="current" size="sm" />}
                  {isPending ? "Saving…" : "Save draft"}
                </>
              )}
            </Button>
            <Button onPress={handleReviewOpen} isDisabled={saving}>
              Review &amp; submit
            </Button>
          </div>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          {DAILY_REPORT_SELF_REPORTED_NOTICE}
        </p>
      </form>

      <DailyReportReview
        isOpen={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open);
          if (!open) setSubmitError(null);
        }}
        reportDateLabel={reportDateLabel}
        metrics={Object.fromEntries(
          DAILY_REPORT_CATEGORIES.flatMap((category) =>
            category.fields.map((field) => [
              field.name,
              resolveCount(values[field.name] ?? "").value,
            ]),
          ),
        )}
        activitySummary={summary.trim().length > 0 ? summary.trim() : null}
        submitting={submitting}
        submitError={submitError}
        onConfirm={handleSubmit}
      />
    </>
  );
}
