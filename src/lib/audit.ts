import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

/** Structured log of important operations (stored in audit_logs + stdout). */
export async function audit(entry: {
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
  ip?: string;
}) {
  if (!process.env.VITEST) console.info(JSON.stringify({ level: "info", type: "audit", ...entry, at: new Date().toISOString() }));
  try {
    await prisma.auditLog.create({ data: { ...entry, actorId: entry.actorId ?? null } });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}
