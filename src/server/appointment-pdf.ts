import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { format } from "date-fns";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import {
  APPOINTMENT_DOCUMENT_TITLE,
  APPOINTMENT_SIGNATORY_LINES,
} from "@/config/appointment";
import type { AppointmentBlock, IssuedAppointmentView } from "@/types/recruitment";

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 54;
const CONTENT_WIDTH = A4.width - MARGIN * 2;
const STAMP_PATH = path.join(process.cwd(), "src", "assets", "1001484186.png");
const LETTERHEAD_PATH = path.join(process.cwd(), "src", "assets", "letterhead.png");
const MAX_PAGES = 2;
const BODY_FONT_SIZE = 9.8;
const BODY_LINE_HEIGHT = 12.2;
const META_FONT_SIZE = 9;

type PdfFonts = {
  regular: PDFFont;
  bold: PDFFont;
};

function sanitizeText(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[₦]/g, "NGN ")
    .replace(/[×]/g, "x")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitizeText(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

function drawLines({
  page,
  lines,
  x,
  y,
  font,
  size,
  lineHeight,
  color = rgb(0.08, 0.1, 0.09),
}: {
  page: PDFPage;
  lines: string[];
  x: number;
  y: number;
  font: PDFFont;
  size: number;
  lineHeight: number;
  color?: ReturnType<typeof rgb>;
}) {
  let cursorY = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursorY, size, font, color });
    cursorY -= lineHeight;
  }
  return cursorY;
}

function addPage(pdf: PDFDocument) {
  return pdf.addPage([A4.width, A4.height]);
}

function ensureSpace(
  pdf: PDFDocument,
  page: PDFPage,
  y: number,
  needed: number,
): { page: PDFPage; y: number } {
  if (y - needed >= MARGIN) return { page, y };
  if (pdf.getPageCount() >= MAX_PAGES) return { page, y };
  return { page: addPage(pdf), y: A4.height - MARGIN };
}

function blockHeight(block: AppointmentBlock, fonts: PdfFonts): number {
  switch (block.type) {
    case "subheading":
      // Reserve room for the heading plus its first line of body text so a
      // section title is not orphaned at the bottom of a page.
      return 56;
    case "paragraph":
      return wrapText(block.text, fonts.regular, BODY_FONT_SIZE, CONTENT_WIDTH).length * BODY_LINE_HEIGHT + 4;
    case "list":
      return block.items.reduce(
        (total, item) =>
          total +
          wrapText(item, fonts.regular, BODY_FONT_SIZE, CONTENT_WIDTH - 16)
            .length *
            BODY_LINE_HEIGHT +
          2,
        3,
      );
    case "alert":
      return (
        wrapText(block.title, fonts.bold, BODY_FONT_SIZE, CONTENT_WIDTH - 14)
          .length *
          BODY_LINE_HEIGHT +
        wrapText(block.text, fonts.regular, 9, CONTENT_WIDTH - 14).length * 11 +
        10
      );
  }
}

function drawBlock(
  pdf: PDFDocument,
  page: PDFPage,
  y: number,
  block: AppointmentBlock,
  fonts: PdfFonts,
) {
  const space = ensureSpace(pdf, page, y, blockHeight(block, fonts));
  page = space.page;
  y = space.y;

  switch (block.type) {
    case "subheading":
      y -= 8;
      page.drawText(sanitizeText(block.text), {
        x: MARGIN,
        y,
        size: 10.8,
        font: fonts.bold,
        color: rgb(0.05, 0.08, 0.07),
      });
      return { page, y: y - 12 };
    case "paragraph": {
      const lines = wrapText(block.text, fonts.regular, BODY_FONT_SIZE, CONTENT_WIDTH);
      return {
        page,
        y: drawLines({
          page,
          lines,
          x: MARGIN,
          y,
          font: fonts.regular,
          size: BODY_FONT_SIZE,
          lineHeight: BODY_LINE_HEIGHT,
        }) - 4,
      };
    }
    case "list": {
      for (const item of block.items) {
        const lines = wrapText(item, fonts.regular, BODY_FONT_SIZE, CONTENT_WIDTH - 16);
        page.drawText("•", {
          x: MARGIN + 2,
          y,
          size: BODY_FONT_SIZE,
          font: fonts.bold,
          color: rgb(0.08, 0.1, 0.09),
        });
        y = drawLines({
          page,
          lines,
          x: MARGIN + 16,
          y,
          font: fonts.regular,
          size: BODY_FONT_SIZE,
          lineHeight: BODY_LINE_HEIGHT,
        }) - 2;
      }
      return { page, y: y - 3 };
    }
    case "alert": {
      const titleLines = wrapText(block.title, fonts.bold, BODY_FONT_SIZE, CONTENT_WIDTH - 14);
      const bodyLines = wrapText(block.text, fonts.regular, 9, CONTENT_WIDTH - 14);
      const height =
        titleLines.length * BODY_LINE_HEIGHT + bodyLines.length * 11 + 8;
      page.drawRectangle({
        x: MARGIN,
        y: y - height + 2,
        width: 2,
        height,
        color: rgb(0.22, 0.48, 0.36),
      });
      let alertY = y - 4;
      alertY = drawLines({
        page,
        lines: titleLines,
        x: MARGIN + 12,
        y: alertY,
        font: fonts.bold,
        size: BODY_FONT_SIZE,
        lineHeight: BODY_LINE_HEIGHT,
      });
      alertY = drawLines({
        page,
        lines: bodyLines,
        x: MARGIN + 12,
        y: alertY,
        font: fonts.regular,
        size: 9,
        lineHeight: 11,
      });
      return { page, y: alertY - 8 };
    }
  }
}

function drawLetterhead(page: PDFPage, letterheadImage: PDFImage) {
  const width = A4.width;
  const height = A4.height;
  page.drawImage(letterheadImage, {
    x: 0,
    y: 0,
    width,
    height,
  });
}

export async function renderAppointmentPdf(
  appointment: IssuedAppointmentView,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts: PdfFonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const letterheadImage = await pdf.embedPng(await readFile(LETTERHEAD_PATH));
  const stampImage = await pdf.embedPng(await readFile(STAMP_PATH));

  let page = addPage(pdf);
  drawLetterhead(page, letterheadImage);
  // The letterhead already provides the top identity block; keep the title
  // close enough to it that the first page reads as one letter.
  let y = 675;

  page.drawText(APPOINTMENT_DOCUMENT_TITLE, {
    x: MARGIN,
    y,
    size: 14.5,
    font: fonts.bold,
    color: rgb(0.05, 0.08, 0.07),
  });
  y -= 22;

  const meta = [
    ["Date", format(new Date(appointment.issuedAt), "d MMMM yyyy")],
    ["Appointment reference", appointment.appointmentReference],
    ["Name", appointment.printedName],
  ];
  for (const [label, value] of meta) {
    page.drawText(label, {
      x: MARGIN,
      y,
      size: META_FONT_SIZE,
      font: fonts.regular,
      color: rgb(0.38, 0.43, 0.4),
    });
    page.drawText(sanitizeText(value), {
      x: MARGIN + 135,
      y,
      size: META_FONT_SIZE,
      font: fonts.bold,
      color: rgb(0.05, 0.08, 0.07),
    });
    y -= 12;
  }

  y -= 9;
  page.drawText(`Subject: ${sanitizeText(appointment.content.subject)}`, {
    x: MARGIN,
    y,
    size: BODY_FONT_SIZE,
    font: fonts.bold,
    color: rgb(0.05, 0.08, 0.07),
  });
  y -= 18;
  page.drawText(`Dear ${sanitizeText(appointment.printedName)},`, {
    x: MARGIN,
    y,
    size: BODY_FONT_SIZE,
    font: fonts.regular,
    color: rgb(0.08, 0.1, 0.09),
  });
  y -= 16;

  for (const block of appointment.content.body) {
    const result = drawBlock(pdf, page, y, block, fonts);
    page = result.page;
    y = result.y;
  }

  const closing = ensureSpace(pdf, page, y, 96);
  page = closing.page;
  y = closing.y - 6;
  page.drawText("Best regards,", {
    x: MARGIN,
    y,
    size: BODY_FONT_SIZE,
    font: fonts.regular,
    color: rgb(0.08, 0.1, 0.09),
  });
  // Leave a deliberate signing gap so the stamp can sit across the closing
  // without crowding the signatory lines.
  y -= 30;

  const stampWidth = 92;
  const stampHeight = (stampImage.height / stampImage.width) * stampWidth;
  page.drawImage(stampImage, {
    x: MARGIN + 88,
    y: y - stampHeight + 34,
    width: stampWidth,
    height: stampHeight,
    opacity: 0.88,
  });

  let signY = y;
  for (const line of APPOINTMENT_SIGNATORY_LINES) {
    page.drawText(line, {
      x: MARGIN,
      y: signY,
      size: BODY_FONT_SIZE,
      font: fonts.bold,
      color: rgb(0.08, 0.1, 0.09),
    });
    signY -= 13;
  }

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: A4.width - MARGIN - 56,
      y: 28,
      size: 8,
      font: fonts.regular,
      color: rgb(0.45, 0.49, 0.47),
    });
  });

  return pdf.save();
}
