import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { getSettings, saveSettingsSection, settingsSchema } from "@/lib/settings";
import { audit } from "@/lib/audit";

export const GET = handle(async () => {
  await requireAdmin();
  return NextResponse.json(await getSettings());
});

export const PUT = handle(async (req: Request) => {
  const admin = await requireAdmin();
  const data = settingsSchema.parse(await req.json());
  for (const key of Object.keys(data) as (keyof typeof data)[]) await saveSettingsSection(key, data[key] as never);
  await audit({ actorId: admin.id, action: "settings.update", entity: "settings" });
  return NextResponse.json(await getSettings());
});
