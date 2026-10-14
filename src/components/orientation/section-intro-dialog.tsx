"use client";

import { useEffect } from "react";
import { Button, Modal, useOverlayState } from "@heroui/react";
import { BookOpen, Sparkles } from "lucide-react";

interface SectionIntroDialogProps {
  sectionId: string;
  sectionIndex: number;
  totalSections: number;
  sectionTitle: string;
  keyPoints: readonly string[];
}

/**
 * Orientation Section Intro Modal.
 *
 * Automatically pops up when the candidate enters the section so they
 * are immediately aware of the learning objectives and key points
 * before reading the detailed body. Also renders an interactive trigger
 * pill allowing the reader to revisit the summary at any time.
 */
export function SectionIntroDialog({
  sectionId,
  sectionIndex,
  totalSections,
  sectionTitle,
  keyPoints,
}: SectionIntroDialogProps) {
  const modal = useOverlayState({ defaultOpen: false });

  useEffect(() => {
    const seenKey = `finfam_orientation_seen_${sectionId}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(seenKey)) {
      sessionStorage.setItem(seenKey, "true");
      const timer = setTimeout(() => {
        modal.open();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [sectionId, modal]);

  return (
    <>
      <button
        type="button"
        onClick={() => modal.open()}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Sparkles className="size-3.5 text-primary" />
        <span>In this section ({keyPoints.length} key points)</span>
      </button>

      <Modal isOpen={modal.isOpen} onOpenChange={modal.setOpen}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog aria-label="In this section overview">
              <Modal.Header>
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Section {sectionIndex} of {totalSections}
                    </p>
                    <Modal.Heading
                      slot="title"
                      className="text-lg font-bold text-foreground"
                    >
                      In this section
                    </Modal.Heading>
                  </div>
                </div>
              </Modal.Header>

              <Modal.Body>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {sectionTitle}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Here is what you need to know in this section:
                    </p>
                  </div>

                  <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-foreground">
                    {keyPoints.map((point) => (
                      <li key={point} className="text-foreground">
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </Modal.Body>

              <Modal.Footer>
                <Button
                  className="w-full sm:w-auto font-semibold"
                  onPress={() => modal.close()}
                >
                  Start Reading Section
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
