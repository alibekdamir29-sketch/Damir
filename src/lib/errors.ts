import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Ресурс") => new AppError("NOT_FOUND", `${what} не найден`, 404);
export const forbidden = () => new AppError("FORBIDDEN", "Недостаточно прав", 403);
export const unauthorized = () => new AppError("UNAUTHORIZED", "Требуется авторизация", 401);

/** Wraps a route handler: converts AppError/ZodError to JSON responses, hides internals. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Проверьте введённые данные", details: err.flatten() } },
      { status: 422 },
    );
  }
  console.error("[unhandled]", err);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Внутренняя ошибка сервера" } }, { status: 500 });
}
