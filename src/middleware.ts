import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF defence for cookie-authenticated API calls: same-origin only.
  // Payment webhooks / cron are server-to-server and verified by signature/secret instead.
  if (pathname.startsWith("/api/") && MUTATING.has(req.method) && !pathname.startsWith("/api/payments/webhook") && !pathname.startsWith("/api/cron")) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) {
      return NextResponse.json({ error: { code: "BAD_ORIGIN", message: "Запрос отклонён" } }, { status: 403 });
    }
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    // First gate only. Every admin page and API re-checks the role in the DB (requireAdmin).
    if (!session || session.role !== "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }
  if (pathname.startsWith("/api/admin") && (!session || session.role !== "ADMIN")) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Недостаточно прав" } }, { status: 403 });
  }
  if (pathname.startsWith("/account") && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/account/:path*", "/api/:path*"] };
