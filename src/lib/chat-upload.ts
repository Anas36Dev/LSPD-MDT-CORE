import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Enregistrement des images collées dans les messageries (canaux de groupe et
 * messagerie directe). L'image arrive en data URL base64 depuis le client ;
 * elle est décodée, validée puis écrite dans `public/uploads/chat`. Retourne le
 * chemin public à stocker en base.
 */
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "chat");
const MAX_BYTES = 8 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
};

export async function saveDataUrl(dataUrl: string): Promise<string> {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error("Image collée invalide.");
  const ext = EXT_BY_MIME[match[1].toLowerCase()];
  if (!ext) throw new Error("Format d'image non pris en charge.");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0) throw new Error("Image collée vide.");
  if (buffer.length > MAX_BYTES) throw new Error("Image trop volumineuse (8 Mo max).");
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/chat/${filename}`;
}
