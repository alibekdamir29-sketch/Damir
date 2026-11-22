import { beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { prisma } from "@/lib/db";
import { createOrder } from "@/lib/orders";
import { POST as webhook } from "@/app/api/payments/webhook/[provider]/route";
import { checkoutInput, makeCart, makeProduct, resetDb } from "../fixtures";

beforeEach(resetDb);

const call = (provider: string, body: string, sig: string) =>
  webhook(new Request(`http://localhost/api/payments/webhook/${provider}`, { method: "POST", body, headers: { "x-damir-signature": sig } }), {
    params: Promise.resolve({ provider }),
  });

describe("payment webhook endpoint", () => {
  it("rejects bad signatures and accepts a correctly signed callback", async () => {
    const { variants } = await makeProduct({ price: 10000, stock: { M: 2 } });
    const o = await createOrder(checkoutInput({ paymentMethod: "ONLINE" }) as never, { cartId: (await makeCart([{ variantId: variants.M, quantity: 1 }])).id });
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: o.order.id } });
    const body = JSON.stringify({ paymentId: payment.id, status: "SUCCEEDED", amount: payment.amount });

    const bad = await call("test", body, "deadbeef");
    expect(bad.status).toBe(401);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.order.id } })).status).toBe("PAYMENT_PENDING");

    const sig = createHmac("sha256", process.env.PAYMENT_WEBHOOK_SECRET!).update(body).digest("hex");
    const good = await call("test", body, sig);
    expect(good.status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.order.id } })).status).toBe("PAID");
    expect((await call("unknown", body, sig)).status).toBe(404);
  });
});
