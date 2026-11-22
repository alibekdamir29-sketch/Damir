import "server-only";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { AppError } from "./errors";

/**
 * Image storage. Default: local disk (UPLOAD_DIR, served by /media/*).
 * For multi-server / serverless hosting, implement the same two functions
 * on top of S3 / Cloudflare R2 / Supabase Storage and switch by env.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: "webp", magic: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  "image/avif": { ext: "avif", magic: (b) => b.subarray(4, 12).toString().startsWith("ftypavi") },
};

export function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
}

export async function saveImage(file: File): Promise<{ url: string }> {
  const type = TYPES[file.type];
  if (!type) throw new AppError("BAD_FILE_TYPE", "Допустимы только JPG, PNG, WEBP, AVIF", 422);
  if (file.size > MAX_BYTES) throw new AppError("FILE_TOO_LARGE", "Максимальный размер файла — 5 МБ", 422);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!type.magic(buf)) throw new AppError("BAD_FILE_TYPE", "Файл не является изображением", 422);
  const now = new Date();
  const rel = path.join("products", `${now.getFullYear()}`, `${String(now.getMonth() + 1).padStart(2, "0")}`);
  const dir = path.join(uploadDir(), rel);
  await mkdir(dir, { recursive: true });
  const name = `${randomBytes(12).toString("hex")}.${type.ext}`;
  await writeFile(path.join(dir, name), buf);
  return { url: `/media/${rel.split(path.sep).join("/")}/${name}` };
}

export async function readMedia(parts: string[]): Promise<{ data: Buffer; type: string } | null> {
  const root = uploadDir();
  const full = path.resolve(root, ...parts);
  if (!full.startsWith(root + path.sep)) return null; // path traversal guard
  const ext = path.extname(full).slice(1).toLowerCase();
  const type = Object.entries(TYPES).find(([, t]) => t.ext === ext)?.[0];
  if (!type) return null;
  try {
    return { data: await readFile(full), type };
  } catch {
    return null;
  }
}
