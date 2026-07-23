"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { canAccessInvestigations, canUseEvidence } from "@/lib/permissions";

export type EvidenceState = { error?: string; success?: string } | undefined;

const fail = (error: string): EvidenceState => ({ error });

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "evidence");
const MAX_BYTES = 8 * 1024 * 1024; // 8 Mo par image collée

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
};

/**
 * Écrit une image collée (data URL base64) comme fichier sur le serveur et
 * renvoie son chemin public. Rejette tout ce qui n'est pas une image reconnue
 * ou qui dépasse la taille maximale.
 */
async function saveDataUrl(dataUrl: string): Promise<string> {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error("Image collée invalide.");

  const ext = EXT_BY_MIME[match[1].toLowerCase()];
  if (!ext) throw new Error("Format d'image non pris en charge.");

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0) throw new Error("Image collée vide.");
  if (buffer.length > MAX_BYTES) {
    throw new Error("Image trop volumineuse (8 Mo maximum).");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/evidence/${filename}`;
}

async function nextReference() {
  const year = new Date().getFullYear();
  const prefix = `EVIDENCE-${year}-`;
  const last = await db.evidenceFolder.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const seq = last ? Number(last.reference.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function createFolder(
  _state: EvidenceState,
  formData: FormData,
): Promise<EvidenceState> {
  let newId: number;
  try {
    const user = await assertPermission(canUseEvidence);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (!title) return fail("Le titre du dossier est obligatoire.");

    const folder = await db.evidenceFolder.create({
      data: {
        reference: await nextReference(),
        title,
        description: description || null,
        authorId: user.id,
      },
    });
    newId = folder.id;

    await audit({
      userId: user.id,
      action: "EVIDENCE_FOLDER_CREATE",
      targetType: "EvidenceFolder",
      targetId: folder.id,
      detail: folder.reference,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }

  revalidatePath("/evidence");
  redirect(`/evidence/${newId}`);
}

export async function addEvidenceItems(
  _state: EvidenceState,
  formData: FormData,
): Promise<EvidenceState> {
  try {
    const user = await assertPermission(canUseEvidence);
    const folderId = Number(formData.get("folderId"));
    const caption = String(formData.get("caption") ?? "").trim();

    const folder = await db.evidenceFolder.findUnique({ where: { id: folderId } });
    if (!folder) return fail("Dossier introuvable.");

    // Images collées : autant de champs cachés `image` que d'images.
    const images = formData
      .getAll("image")
      .map((v) => String(v))
      .filter((v) => v.startsWith("data:"));

    // Liens externes : un par ligne dans le champ `links`.
    const links = String(formData.get("links") ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (images.length === 0 && links.length === 0) {
      return fail("Collez une image (CTRL+V) ou saisissez au moins un lien.");
    }

    for (const link of links) {
      if (!/^https?:\/\//i.test(link)) {
        return fail(`Lien invalide : ${link}`);
      }
    }

    const created: { kind: string; url: string; caption: string | null }[] = [];
    for (const dataUrl of images) {
      const url = await saveDataUrl(dataUrl);
      created.push({ kind: "IMAGE", url, caption: caption || null });
    }
    for (const link of links) {
      created.push({ kind: "LINK", url: link, caption: caption || null });
    }

    await db.$transaction([
      db.evidenceItem.createMany({
        data: created.map((c) => ({
          folderId,
          kind: c.kind,
          url: c.url,
          caption: c.caption,
          addedById: user.id,
        })),
      }),
      db.evidenceFolder.update({
        where: { id: folderId },
        data: { updatedAt: new Date() },
      }),
    ]);

    await audit({
      userId: user.id,
      action: "EVIDENCE_ITEM_ADD",
      targetType: "EvidenceFolder",
      targetId: folderId,
      detail: `${created.length} pièce(s)`,
    });

    revalidatePath(`/evidence/${folderId}`);
    return { success: `${created.length} pièce(s) ajoutée(s).` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deleteEvidenceItem(formData: FormData) {
  const user = await assertPermission(canUseEvidence);
  const id = Number(formData.get("itemId"));
  const item = await db.evidenceItem.findUnique({ where: { id } });
  if (!item) throw new Error("Pièce introuvable.");

  await db.evidenceItem.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "EVIDENCE_ITEM_DELETE",
    targetType: "EvidenceFolder",
    targetId: item.folderId,
  });

  revalidatePath(`/evidence/${item.folderId}`);
}

/** Rattacher / détacher un dossier de preuves à une enquête — réservé au Detective Bureau. */
export async function linkFolderToInvestigation(
  _state: EvidenceState,
  formData: FormData,
): Promise<EvidenceState> {
  try {
    const user = await assertPermission(canAccessInvestigations);
    const folderId = Number(formData.get("folderId"));
    const raw = String(formData.get("investigationId") ?? "");
    const investigationId = raw ? Number(raw) : null;

    if (investigationId) {
      const inv = await db.investigation.findUnique({
        where: { id: investigationId },
        select: { id: true },
      });
      if (!inv) return fail("Enquête introuvable.");
    }

    await db.evidenceFolder.update({
      where: { id: folderId },
      data: { investigationId },
    });

    await audit({
      userId: user.id,
      action: investigationId ? "EVIDENCE_LINK_INV" : "EVIDENCE_UNLINK_INV",
      targetType: "EvidenceFolder",
      targetId: folderId,
      detail: investigationId ? `Enquête #${investigationId}` : undefined,
    });

    revalidatePath(`/evidence/${folderId}`);
    return {
      success: investigationId
        ? "Dossier rattaché à l'enquête."
        : "Dossier détaché de l'enquête.",
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deleteFolder(formData: FormData) {
  const user = await assertPermission(canUseEvidence);
  const id = Number(formData.get("folderId"));
  const folder = await db.evidenceFolder.findUnique({ where: { id } });
  if (!folder) throw new Error("Dossier introuvable.");

  // Seul l'auteur du dossier peut le supprimer (ou un membre du Command Staff
  // via ses droits élargis passant déjà `canUseEvidence`).
  await db.evidenceFolder.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "EVIDENCE_FOLDER_DELETE",
    targetType: "EvidenceFolder",
    targetId: id,
    detail: folder.reference,
  });

  revalidatePath("/evidence");
  redirect("/evidence");
}
