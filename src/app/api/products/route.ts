import { NextResponse } from "next/server";
import { listProducts } from "@/lib/catalog";
import { handle } from "@/lib/errors";

export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const raw: Record<string, string> = {};
  sp.forEach((v, k) => (raw[k] = v));
  return NextResponse.json(await listProducts(raw));
});
