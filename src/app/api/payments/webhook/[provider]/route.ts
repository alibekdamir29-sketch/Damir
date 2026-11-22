import { getProviderById } from "@/lib/payments";
import { applyPaymentEvent } from "@/lib/orders";
import { AppError, toErrorResponse } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

/** Payment provider callback. The ONLY place where an online payment can become "paid". */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  const provider = getProviderById(providerId);
  if (!provider) return Response.json({ error: "unknown provider" }, { status: 404 });
  const rawBody = await req.text();
  try {
    const event = await provider.parseWebhook(req, rawBody); // throws on bad signature
    await applyPaymentEvent(provider.id, event);
    return provider.ackResponse();
  } catch (e) {
    if (e instanceof AppError && e.code === "BAD_SIGNATURE") {
      await audit({ action: "payment.webhook_bad_signature", meta: { provider: providerId }, ip: clientIp(req) });
    }
    return toErrorResponse(e);
  }
}
