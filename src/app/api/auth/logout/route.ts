import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { CART_COOKIE } from "@/lib/session";

export async function POST() {
  await endSession();
  (await cookies()).delete(CART_COOKIE);
  return NextResponse.json({ ok: true });
}
