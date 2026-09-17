"use client";

import { Button } from "@heroui/react";

export function PrintButton({ className }: { className?: string }) {
  return (
    <Button variant="primary" onPress={() => window.print()} className={className}>
      Print / Save as PDF
    </Button>
  );
}
