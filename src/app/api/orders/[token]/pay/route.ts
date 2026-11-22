import { NextResponse } from "next/server";
import { handle } from "@/lib/errors";
import { restartOnlinePayment } from "@/lib/orders";

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  return NextResponse.json({ redirectUrl: await restartOnlinePayment(token) });
});
