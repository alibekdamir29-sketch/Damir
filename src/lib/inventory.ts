import "server-only";
import { Prisma, type MovementType } from "@prisma/client";
import { prisma } from "./db";
import { AppError } from "./errors";

type Tx = Prisma.TransactionClient;
type Row = { quantity: number; reserved: number };

/**
 * All stock changes go through these functions. Each one is a single atomic
 * conditional UPDATE, so two concurrent orders can never both take the last unit:
 * the second UPDATE matches 0 rows and the transaction is rolled back.
 * DB CHECK constraints (quantity >= 0, 0 <= reserved <= quantity) are the last line of defence.
 */
async function log(tx: Tx, variantId: string, type: MovementType, qd: number, rd: number, after: Row, extra: { orderId?: string; adminId?: string; reason?: string }) {
  await tx.inventoryMovement.create({
    data: { variantId, type, quantityDelta: qd, reservedDelta: rd, quantityAfter: after.quantity, reservedAfter: after.reserved, ...extra },
  });
}

export async function reserveStock(tx: Tx, variantId: string, qty: number, orderId: string) {
  const rows = await tx.$queryRaw<Row[]>`
    UPDATE inventory SET reserved = reserved + ${qty}, updated_at = now()
    WHERE variant_id = ${variantId} AND quantity - reserved >= ${qty}
    RETURNING quantity, reserved`;
  if (rows.length === 0) {
    const inv = await tx.inventory.findUnique({ where: { variantId } });
    const avail = inv ? Math.max(0, inv.quantity - inv.reserved) : 0;
    throw new AppError("INSUFFICIENT_STOCK", "Пока вы оформляли заказ, часть товара закончилась", 409, { variantId, available: avail });
  }
  await log(tx, variantId, "RESERVE", 0, qty, rows[0], { orderId });
}

export async function releaseStock(tx: Tx, variantId: string, qty: number, orderId: string, reason?: string) {
  const rows = await tx.$queryRaw<Row[]>`
    UPDATE inventory SET reserved = reserved - ${qty}, updated_at = now()
    WHERE variant_id = ${variantId} AND reserved >= ${qty}
    RETURNING quantity, reserved`;
  if (rows.length === 0) throw new AppError("INVENTORY_STATE", "Несогласованный резерв склада", 409, { variantId });
  await log(tx, variantId, "RELEASE", 0, -qty, rows[0], { orderId, reason });
}

/** Reserved units leave the warehouse (order shipped). */
export async function commitSale(tx: Tx, variantId: string, qty: number, orderId: string) {
  const rows = await tx.$queryRaw<Row[]>`
    UPDATE inventory SET quantity = quantity - ${qty}, reserved = reserved - ${qty}, updated_at = now()
    WHERE variant_id = ${variantId} AND reserved >= ${qty} AND quantity >= ${qty}
    RETURNING quantity, reserved`;
  if (rows.length === 0) throw new AppError("INVENTORY_STATE", "Несогласованный резерв склада", 409, { variantId });
  await log(tx, variantId, "SALE", -qty, -qty, rows[0], { orderId });
}

/** Admin stock change: either set an absolute on-hand quantity or apply a delta. */
export async function adjustStock(input: {
  variantId: string;
  adminId: string;
  set?: number;
  delta?: number;
  type?: "RESTOCK" | "ADJUSTMENT" | "RETURN" | "INITIAL";
  reason?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Row[]>`SELECT quantity, reserved FROM inventory WHERE variant_id = ${input.variantId} FOR UPDATE`;
    let current = locked[0];
    if (!current) {
      await tx.inventory.create({ data: { variantId: input.variantId, quantity: 0, reserved: 0 } });
      current = { quantity: 0, reserved: 0 };
    }
    const next = input.set != null ? input.set : current.quantity + (input.delta ?? 0);
    if (!Number.isInteger(next) || next < 0) throw new AppError("NEGATIVE_STOCK", "Остаток не может быть отрицательным", 422);
    if (next < current.reserved)
      throw new AppError("BELOW_RESERVED", `Нельзя установить меньше, чем зарезервировано заказами (${current.reserved})`, 422);
    const delta = next - current.quantity;
    if (delta === 0) return current;
    const after = await tx.inventory.update({ where: { variantId: input.variantId }, data: { quantity: next } });
    await log(tx, input.variantId, input.type ?? (delta > 0 ? "RESTOCK" : "ADJUSTMENT"), delta, 0, after, { adminId: input.adminId, reason: input.reason });
    return after;
  });
}
