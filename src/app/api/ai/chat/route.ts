import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, handle } from "@/lib/errors";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateCartId } from "@/lib/cart";
import { AI_COOKIE, cookieOptions, signId, verifyId } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { MAX_MESSAGE_LENGTH, chat, getHistory } from "@/lib/ai/consultant";

export const maxDuration = 60;

const bodySchema = z.object({ message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH), reset: z.boolean().optional() });

async function currentConversationId() {
  return verifyId("ai", (await cookies()).get(AI_COOKIE)?.value);
}

export const GET = handle(async () => {
  const id = await currentConversationId();
  if (!id) return NextResponse.json({ messages: [], enabled: !!process.env.ANTHROPIC_API_KEY });
  return NextResponse.json({ messages: await getHistory(id), enabled: !!process.env.ANTHROPIC_API_KEY });
});

export const POST = handle(async (req: Request) => {
  const ip = clientIp(req);
  // Rate limits: burst + daily per IP (protects the API budget from abuse).
  const burst = rateLimit(`ai:min:${ip}`, 10, 60_000);
  const daily = rateLimit(`ai:day:${ip}`, 150, 24 * 60 * 60_000);
  if (!burst.ok || !daily.ok) {
    throw new AppError("RATE_LIMIT", "Слишком много сообщений. Попробуйте чуть позже.", 429, { retryAfter: Math.max(burst.retryAfter, daily.retryAfter) });
  }
  const { message, reset } = bodySchema.parse(await req.json());
  const user = await getCurrentUser();
  const cartId = await getOrCreateCartId(user?.id);

  let conversationId = reset ? null : await currentConversationId();
  if (conversationId && !(await prisma.aiConversation.findUnique({ where: { id: conversationId }, select: { id: true } }))) conversationId = null;
  if (!conversationId) {
    const conv = await prisma.aiConversation.create({
      data: { userId: user?.id ?? null, cartId, ipHash: createHash("sha256").update(`${ip}:${process.env.AUTH_SECRET}`).digest("hex").slice(0, 32) },
    });
    conversationId = conv.id;
    (await cookies()).set(AI_COOKIE, await signId("ai", conv.id), { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 });
  }

  const reply = await chat(conversationId, message, cartId);
  return NextResponse.json(reply);
});

export const DELETE = handle(async () => {
  (await cookies()).delete(AI_COOKIE);
  return NextResponse.json({ ok: true });
});
