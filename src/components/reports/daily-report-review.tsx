"use client";

import {
  Button,
  Modal,
  Spinner,
} from "@heroui/react";

import { DAILY_REPORT_CATEGORIES } from "@/config/daily-report";

/**
 * Focused submit review (Stage 8) — the LAST look before a report becomes
 * final. Shows exactly the values that will be persisted (all nine counts
 * with their visible approved meanings, plus the optional summary), the
 * reporting date, and the permanent read-only consequence of submitting.
 *
 * Deliberately NO acknowledgement checkbox (approved MVP): the focused
 * modal itself is the deliberate confirmation step — the server performs
 * the authoritative validation and the one-way latch either way.
 *
 * The component is presentational; the form owns the values and the
 * submit call and passes them down. Labels come from the same code-owned
 * config the form renders, so the review can never drift from the fields.
 */
export function DailyReportReview({
  isOpen,
  onOpenChange,
  reportDateLabel,
  metrics,
  activitySummary,
  submitting,
  submitError,
  onConfirm,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Preformatted Africa/Lagos label (computed on the server). */
  reportDateLabel: string;
  /** Resolved metric values keyed by config field name. */
  metrics: Record<string, number>;
  activitySummary: string | null;
  submitting: boolean;
  submitError: string | null;
  onConfirm: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md">
          <Modal.Dialog aria-label="Review and submit daily report">
            <Modal.Header>
              <Modal.Heading
                slot="title"
                className="text-lg font-bold text-foreground"
              >
                Review and submit
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm leading-6 text-muted-foreground">
                Check your report for{" "}
                <span className="font-semibold text-foreground">
                  {reportDateLabel}
                </span>
                . Submitting is final — a submitted report can no longer be
                changed.
              </p>

              <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border bg-surface p-4">
                {DAILY_REPORT_CATEGORIES.map((category) => (
                  <div
                    key={category.id}
                    className="[&:not(:first-child)]:mt-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {category.legend}
                    </p>
                    <dl className="mt-2 space-y-1.5">
                      {category.fields.map((field) => (
                        <div
                          key={field.name}
                          className="flex items-baseline justify-between gap-4"
                        >
                          <dt className="text-sm text-muted-foreground">
                            {field.label}
                          </dt>
                          <dd className="text-sm font-semibold tabular-nums text-foreground">
                            {metrics[field.name] ?? 0}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}

                {activitySummary && (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Activity summary
                    </p>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-foreground">
                      {activitySummary}
                    </p>
                  </div>
                )}
              </div>

              {submitError && (
                <p role="alert" className="text-sm text-danger">
                  {submitError}
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="outline"
                onPress={() => onOpenChange(false)}
                isDisabled={submitting}
              >
                Go back
              </Button>
              <Button onPress={onConfirm} isPending={submitting}>
                {({ isPending }) => (
                  <>
                    {isPending && <Spinner color="current" size="sm" />}
                    {isPending ? "Submitting…" : "Submit report"}
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
