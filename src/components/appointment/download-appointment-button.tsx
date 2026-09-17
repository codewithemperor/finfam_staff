import { Download } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";

export function DownloadAppointmentButton({
  reference,
  className,
}: {
  reference: string;
  className?: string;
}) {
  return (
    <ButtonLink
      href={`/api/appointment/${reference}/download`}
      className={className}
      download
    >
      <Download aria-hidden className="size-4" />
      Download PDF
    </ButtonLink>
  );
}
