"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { canManageAcademyDocs } from "@/lib/permissions";

export type AcademyDocState = { error?: string; success?: string } | undefined;

const fail = (error: string): AcademyDocState => ({ error });
const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

export async function createAcademyDocument(
  _state: AcademyDocState,
  formData: FormData,
): Promise<AcademyDocState> {
  try {
    const user = await assertPermission(canManageAcademyDocs);

    const title = String(formData.get("title") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    if (!title) return fail("Le titre est obligatoire.");
    if (!content) return fail("Le contenu est obligatoire.");

    const visibility =
      String(formData.get("visibility") ?? "ALL") === "INSTRUCTORS"
        ? "INSTRUCTORS"
        : "ALL";

    const doc = await db.academyDocument.create({
      data: {
        title,
        content,
        fileUrl: text(formData.get("fileUrl")),
        visibility,
        authorId: user.id,
      },
    });

    await audit({
      userId: user.id,
      action: "ACADEMY_DOC_CREATE",
      targetType: "AcademyDocument",
      targetId: doc.id,
      detail: title,
    });

    revalidatePath("/academy/documents");
    return { success: "Document publié." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deleteAcademyDocument(formData: FormData) {
  const user = await assertPermission(canManageAcademyDocs);
  const id = Number(formData.get("documentId"));

  const doc = await db.academyDocument.findUnique({ where: { id } });
  if (!doc) throw new Error("Document introuvable.");

  await db.academyDocument.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "ACADEMY_DOC_DELETE",
    targetType: "AcademyDocument",
    targetId: id,
    detail: doc.title,
  });

  revalidatePath("/academy/documents");
}
