import "server-only";

import { db } from "@/lib/db";

export const SETTING_KEYS = {
  WHATSAPP_GROUP_LINK: "official_whatsapp_group_link",
} as const;

/**
 * Retrieve a system setting from the database, with optional fallback.
 */
export async function getSystemSetting(
  key: string,
  defaultValue = "",
): Promise<string> {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    if (setting && setting.value.trim()) {
      return setting.value.trim();
    }
  } catch {
    // If DB read fails, continue to default
  }
  return defaultValue;
}

/**
 * Upsert a system setting in the database and optionally record an audit event.
 */
export async function setSystemSetting(
  key: string,
  value: string,
  actorId?: string,
): Promise<void> {
  const trimmed = value.trim();

  await db.$transaction(async (tx) => {
    const previous = await tx.systemSetting.findUnique({
      where: { key },
      select: { value: true },
    });

    const updated = await tx.systemSetting.upsert({
      where: { key },
      create: { key, value: trimmed },
      update: { value: trimmed },
    });

    if (actorId) {
      await tx.adminAuditEvent.create({
        data: {
          actorId,
          action: "SETTINGS_UPDATED",
          targetType: "SYSTEM_SETTING",
          targetId: updated.id,
          reason: `Updated ${key}`,
          metadata: {
            settingKey: key,
            previousValue: previous?.value ?? null,
            newValue: trimmed,
          },
        },
      });
    }
  });
}

/**
 * Retrieve the active Official Staff WhatsApp Group link.
 */
export async function getOfficialWhatsappGroupLink(): Promise<string> {
  const fallback = process.env.OFFICIAL_WHATSAPP_GROUP_LINK?.trim() ?? "";
  return getSystemSetting(SETTING_KEYS.WHATSAPP_GROUP_LINK, fallback);
}
