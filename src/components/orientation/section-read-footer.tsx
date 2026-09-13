"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Spinner, toast } from "@heroui/react";
import { Check } from "lucide-react";

import { CompleteOrientationButton } from "@/components/orientation/complete-orientation-button";
import { ButtonLink } from "@/components/ui/button-link";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { OrientationView } from "@/types/recruitment";

export interface SectionNeighbour {
  href: string;
  title: string;
}

interface SectionReadFooterProps {
  reference: string;
  sectionId: string;
  isCompleted: boolean;
  isLast: boolean;
  prev: SectionNeighbour | null;
  next: SectionNeighbour | null;
  overviewHref: string;
}

/**
 * The one primary action of a section page: mark the section as read and
 * move on. Progress is persisted server-side before the candidate is taken
 * to the next section — leaving mid-section never loses a confirmed read,
 * and an unconfirmed read is never faked.
 */
export function SectionReadFooter({
  reference,
  sectionId,
  isCompleted,
  isLast,
  prev,
  next,
  overviewHref,
}: SectionReadFooterProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markAsRead() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      await apiFetch<OrientationView>(
        `/api/orientation/${reference}/sections`,
        {
          method: "POST",
          body: JSON.stringify({ sectionId }),
        },
      );
      toast("Section marked as read", { variant: "success" });
      router.push(
        next?.href ?? overviewHref,
      );
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "We couldn't save your progress. Please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-12 border-t border-divider pt-6">
      {error && (
        <Alert status="danger" className="mb-4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>We couldn&apos;t save your progress.</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {isCompleted ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check aria-hidden className="size-4 text-primary" />
            {isLast
              ? "Every section has been read."
              : "Section marked as read."}
          </p>
          {isLast ? (
            <CompleteOrientationButton reference={reference} />
          ) : (
            next && (
              <ButtonLink href={next.href} className="sm:w-auto">
                Next section
              </ButtonLink>
            )
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {prev ? (
            <ButtonLink
              href={prev.href}
              variant="outline"
              className="order-2 sm:order-1 sm:w-auto"
            >
              Previous: {prev.title}
            </ButtonLink>
          ) : (
            <span />
          )}
          <Button
            onPress={markAsRead}
            isPending={submitting}
            className="order-1 w-full sm:order-2 sm:w-auto"
          >
            {({ isPending }) => (
              <>
                {isPending && <Spinner color="current" size="sm" />}
                {isPending ? "Saving…" : "Mark as read & continue"}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
