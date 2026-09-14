"use client";

import { Button } from "@heroui/react";

/**
 * "Print / Save as PDF" — opens the browser's print dialog over the
 * appointment page. The print stylesheet strips the app chrome and keeps
 * only the letter document, so what the candidate saves is the letter
 * itself. Honest wording: the browser produces the PDF — the portal does
 * not pretend to generate a downloadable file.
 */
export function PrintButton({ className }: { className?: string }) {
  return (
    <Button variant="outline" onPress={() => window.print()} className={className}>
      Print / Save as PDF
    </Button>
  );
}
