import { NextResponse } from "next/server";
import { getProductCardsByIds } from "@/lib/catalog";
import { handle } from "@/lib/errors";

export const GET = handle(async (req: Request) => {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter((x) => /^[a-z0-9]{10,40}$/i.test(x)).slice(0, 60);
  return NextResponse.json({ items: await getProductCardsByIds(ids) });
});
