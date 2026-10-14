import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSession } from "@/lib/auth/admin-session";
import {
  getOfficialWhatsappGroupLink,
  setSystemSetting,
  SETTING_KEYS,
} from "@/server/services/system-settings";

const settingsUpdateSchema = z.object({
  whatsappGroupLink: z
    .string()
    .trim()
    .url("Enter a valid URL (e.g. https://chat.whatsapp.com/...)")
    .or(z.literal("")),
});

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const whatsappGroupLink = await getOfficialWhatsappGroupLink();
  return NextResponse.json({
    ok: true,
    data: {
      whatsappGroupLink,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const parsed = settingsUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_FAILED",
            message: parsed.error.issues[0]?.message || "Invalid settings input",
          },
        },
        { status: 400 },
      );
    }

    await setSystemSetting(
      SETTING_KEYS.WHATSAPP_GROUP_LINK,
      parsed.data.whatsappGroupLink,
      session.account.id,
    );

    return NextResponse.json({
      ok: true,
      data: {
        whatsappGroupLink: parsed.data.whatsappGroupLink,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update settings";
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
