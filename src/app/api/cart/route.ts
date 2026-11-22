import { NextResponse } from "next/server";
import { getCartId, loadCart } from "@/lib/cart";
import { handle } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = handle(async () => NextResponse.json(await loadCart(await getCartId())));
