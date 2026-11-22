import { createHmac, timingSafeEqual } from "crypto";

export function hmacSha256(secret: string, data: string, encoding: "hex" | "base64" = "hex") {
  return createHmac("sha256", secret).update(data, "utf8").digest(encoding);
}

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
