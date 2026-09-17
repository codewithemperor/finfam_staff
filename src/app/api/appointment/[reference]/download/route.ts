import type { NextRequest } from "next/server";

import { normalizeReferenceNumber } from "@/lib/reference";
import { renderAppointmentPdf } from "@/server/appointment-pdf";
import { getAppointmentView } from "@/server/services/appointment";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  const { reference } = await context.params;
  const view = await getAppointmentView(normalizeReferenceNumber(reference));

  if (!view.issued || !view.appointment) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Your appointment letter is not available yet.",
        },
      },
      { status: 409 },
    );
  }

  const pdf = await renderAppointmentPdf(view.appointment);
  const filename = `${view.appointment.appointmentReference.replaceAll("/", "-")}.pdf`;
  const body = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(body).set(pdf);

  return new Response(body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
