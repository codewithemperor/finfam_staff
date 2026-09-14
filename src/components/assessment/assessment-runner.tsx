"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  FieldError,
  Modal,
  Radio,
  RadioGroup,
  Spinner,
  toast,
  useOverlayState,
} from "@heroui/react";

import { ApiClientError, apiFetch } from "@/lib/api/client";
import { getAnswerMap, getAttemptProgress, getResumeIndex } from "@/lib/assessment";
import { cn } from "@/lib/utils";
import type { AssessmentAttemptState, AssessmentView } from "@/types/recruitment";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

/**
 * The assessment runner: one question at a time with server autosave.
 *
 * - Selections persist server-side (idempotent upsert per question); the
 *   optimistic local state keeps navigation instant, and a failed save is
 *   surfaced for retry without losing the selection.
 * - Question order comes from the attempt's persisted set — the client
 *   only moves within it.
 * - Submission is a focused modal decision; the server scores and is the
 *   sole authority on the result.
 */
export function AssessmentRunner({
  reference,
  attempt,
}: {
  reference: string;
  attempt: AssessmentAttemptState;
}) {
  const router = useRouter();
  const modal = useOverlayState();

  const [answers, setAnswers] = useState<Map<string, number>>(
    () => getAnswerMap(attempt.answers),
  );
  const [currentIndex, setCurrentIndex] = useState(() => getResumeIndex(attempt));
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const questions = attempt.questions;
  const progress = useMemo(
    () => getAttemptProgress({ ...attempt, answers: [...answers].map(([questionId, selectedOption]) => ({ questionId, selectedOption })) }),
    [attempt, answers],
  );

  const current = questions[currentIndex];
  const selected = current ? answers.get(current.id) : undefined;

  // Latest-value-wins guard: if a save for question X resolves but the user
  // has already chosen a different option for X, re-fire with the newest
  // value so the server always converges to what the candidate sees.
  const latestRef = useRef(new Map<string, number>());

  const persistAnswer = useCallback(
    async (questionId: string, selectedOption: number) => {
      latestRef.current.set(questionId, selectedOption);
      setSaveState({ kind: "saving" });

      try {
        await apiFetch(`/api/assessment/${reference}/answers`, {
          method: "POST",
          body: JSON.stringify({ questionId, selectedOption }),
        });

        if (latestRef.current.get(questionId) !== selectedOption) {
          return; // a newer selection for this question is already queued
        }
        setSaveState({ kind: "saved" });
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 409) {
          // The attempt was submitted elsewhere (or closed) — surface it.
          setSaveState({ kind: "error", message: error.message });
          return;
        }
        setSaveState({
          kind: "error",
          message:
            error instanceof ApiClientError
              ? error.message
              : "We couldn't save your answer. Check your connection and try again — your selection is kept.",
        });
      }
    },
    [reference],
  );

  function handleSelect(optionIndex: number) {
    if (!current) return;
    setAnswers((previous) => {
      const next = new Map(previous);
      next.set(current.id, optionIndex);
      return next;
    });
    void persistAnswer(current.id, optionIndex);
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      await apiFetch<AssessmentView>(
        `/api/assessment/${reference}/submit`,
        { method: "POST", body: JSON.stringify({}) },
      );
      modal.close();
      toast("Assessment submitted", {
        description: "Your result has been recorded.",
        variant: "success",
      });
      router.replace(`/assessment/${reference}`);
    } catch (error) {
      setSubmitError(
        error instanceof ApiClientError
          ? error.message
          : "We couldn't submit your assessment. Please check your connection and try again.",
      );
      setSubmitting(false);
    }
  }

  function handleModalOpenChange(isOpen: boolean) {
    if (!isOpen) setSubmitError(null);
    modal.setOpen(isOpen);
  }

  if (!current) return null;

  const saveIndicator =
    saveState.kind === "saving"
      ? "Saving…"
      : saveState.kind === "saved"
        ? "All changes saved"
        : null;

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_16rem] lg:grid-cols-[minmax(0,1fr)_18rem] md:gap-10 lg:gap-12 xl:gap-14">
      {/* ----------------------------------------------------- */}
      {/* Question column */}
      {/* ----------------------------------------------------- */}
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-4">
          <Link
            href={`/assessment/${reference}`}
            className="rounded-md text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            ← Assessment overview
          </Link>
          <p className="text-sm tabular-nums text-muted-foreground">
            Question{" "}
            <span className="font-semibold text-foreground">
              {currentIndex + 1}
            </span>{" "}
            of {questions.length}
          </p>
        </div>

        {/* Mobile progress line — compact context above the question. */}
        <div
          role="progressbar"
          aria-label="Assessment progress"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.answered}
          aria-valuetext={`${progress.answered} of ${progress.total} questions answered`}
          className="mt-5 h-1 overflow-hidden rounded-full bg-divider md:hidden"
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{
              width: `${(progress.answered / progress.total) * 100}%`,
            }}
          />
        </div>

        <h1 className="mt-6 text-2xl font-bold leading-snug tracking-tight text-foreground">
          {current.text}
        </h1>

        <RadioGroup
          aria-label={current.text}
          value={selected === undefined ? "" : String(selected)}
          onChange={(value) => handleSelect(Number(value))}
          className="mt-2"
        >
          <ul className="m-0 list-none p-0" aria-label="Answer options">
            {current.options.map((option, optionIndex) => {
              const isSelected = selected === optionIndex;
              return (
                <li
                  key={optionIndex}
                  className={cn(
                    "border-b border-divider last:border-b-0",
                    isSelected && "bg-surface",
                  )}
                >
                  <Radio value={String(optionIndex)} className="w-full">
                    <Radio.Content
                      value={String(optionIndex)}
                      className={cn(
                        "w-full items-start gap-3 px-2 py-3.5 outline-none focus-visible:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                      )}
                    >
                      <Radio.Control className="mt-0.5">
                        <Radio.Indicator />
                      </Radio.Control>
                      <span className="text-base leading-6 text-foreground">
                        {option}
                      </span>
                    </Radio.Content>
                  </Radio>
                </li>
              );
            })}
          </ul>
        </RadioGroup>

        <p aria-live="polite" className="mt-3 min-h-5 text-sm text-muted-foreground">
          {saveIndicator}
          {saveState.kind === "error" && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-danger">
              {saveState.message}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onPress={() => {
                  if (selected !== undefined) {
                    void persistAnswer(current.id, selected);
                  }
                }}
              >
                Try again
              </Button>
            </span>
          )}
        </p>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-divider pt-6">
          <Button
            variant="outline"
            isDisabled={currentIndex === 0 || submitting}
            onPress={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          >
            ← Previous
          </Button>
          <Button
            isDisabled={
              currentIndex === questions.length - 1 || submitting
            }
            onPress={() =>
              setCurrentIndex((index) =>
                Math.min(questions.length - 1, index + 1),
              )
            }
          >
            Next →
          </Button>
        </div>

        {/* Mobile submission entry point */}
        <div className="mt-6 md:hidden">
          <Button
            variant="outline"
            fullWidth
            isDisabled={submitting}
            onPress={() => handleModalOpenChange(true)}
          >
            Submit assessment
          </Button>
        </div>
      </div>

      {/* ----------------------------------------------------- */}
      {/* Progress rail (tablet+) */}
      {/* ----------------------------------------------------- */}
      <aside
        aria-label="Assessment progress"
        className="hidden self-start md:block md:sticky md:top-8"
      >
        <h2 className="text-sm font-semibold text-foreground">Your progress</h2>
        <p className="mt-2 text-lg font-bold tabular-nums text-foreground">
          {progress.answered} of {progress.total} answered
        </p>
        <div
          role="progressbar"
          aria-label="Assessment questions answered"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.answered}
          aria-valuetext={`${progress.answered} of ${progress.total} questions answered`}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-divider"
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{
              width: `${(progress.answered / progress.total) * 100}%`,
            }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {progress.remaining === 0
            ? "Every question answered."
            : `${progress.remaining} question${progress.remaining === 1 ? "" : "s"} remaining.`}
        </p>

        {/* Question grid — jump navigation. State is never colour-only:
            answered cells are filled, the current cell is outlined, and
            every cell carries an aria-label with its state. */}
        <ol
          aria-label="Questions"
          className="mt-5 grid list-none grid-cols-6 gap-1.5 p-0 lg:grid-cols-5"
        >
          {questions.map((question, index) => {
            const isAnswered = answers.has(question.id);
            const isCurrent = index === currentIndex;
            return (
              <li key={question.id}>
                <button
                  type="button"
                  aria-label={`Question ${index + 1}${isAnswered ? ", answered" : ", not answered"}${isCurrent ? ", current" : ""}`}
                  aria-current={isCurrent ? "true" : undefined}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "grid h-8 w-full place-items-center rounded-md border text-xs font-medium tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                    isAnswered
                      ? "border-primary/30 bg-accent/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
                    isCurrent && "border-primary ring-2 ring-primary",
                  )}
                >
                  {index + 1}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 border-t border-divider pt-5">
          <Button
            fullWidth
            isDisabled={submitting}
            onPress={() => handleModalOpenChange(true)}
          >
            Submit assessment
          </Button>
        </div>
      </aside>

      {/* ----------------------------------------------------- */}
      {/* Submission modal — the focused final decision */}
      {/* ----------------------------------------------------- */}
      <Modal isOpen={modal.isOpen} onOpenChange={handleModalOpenChange}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog aria-label="Submit assessment">
              <Modal.Header>
                <Modal.Heading
                  slot="title"
                  className="text-lg font-bold text-foreground"
                >
                  Submit assessment?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm leading-6 text-muted-foreground">
                  You have answered {progress.answered} of {progress.total}{" "}
                  questions. Your assessment will be scored automatically
                  after submission.
                </p>
                {progress.remaining > 0 && (
                  <p className="text-sm leading-6 text-foreground">
                    {progress.remaining} question
                    {progress.remaining === 1 ? " is" : "s are"} unanswered.
                    Unanswered questions are scored as incorrect.
                  </p>
                )}
                <p className="text-sm leading-6 text-muted-foreground">
                  Submission is final — answers can no longer be changed
                  afterwards.
                </p>
                {submitError && (
                  <FieldError>{submitError}</FieldError>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="outline"
                  onPress={() => handleModalOpenChange(false)}
                  isDisabled={submitting}
                >
                  Continue reviewing
                </Button>
                <Button onPress={handleSubmit} isPending={submitting}>
                  {({ isPending }) => (
                    <>
                      {isPending && <Spinner color="current" size="sm" />}
                      {isPending ? "Submitting…" : "Submit assessment"}
                    </>
                  )}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

