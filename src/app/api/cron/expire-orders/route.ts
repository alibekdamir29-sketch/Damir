import { NextResponse } from "next/server";
import { expireUnpaidOrders } from "@/lib/orders";
import { safeEqual } from "@/lib/payments/crypto";

/** Call every 10–15 min from a scheduler: Authorization: Bearer $CRON_SECRET */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !safeEqual(got, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const minutes = Number(process.env.UNPAID_ORDER_TTL_MINUTES ?? 60);
  return NextResponse.json(await expireUnpaidOrders(minutes));
}
export const GET = POST;
