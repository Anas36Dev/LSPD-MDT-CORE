"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { canManageDivisionDocs } from "@/lib/permissions";

export type DocState = { error?: string; success?: string } | undefined;

const fail = (error: string): DocState => ({ error });
const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

export async function createDivisionDocument(
  _state: DocState,
  formData: FormData,
): Promise<DocState> {
  try {
    const code = String(formData.get("code") ?? "").toUpperCase();
    const user = await assertPermission((u) => canManageDivisionDocs(u, code));

    const division = await db.division.findUnique({ where: { code } });
    if (!division) return fail("Division introuvable.");

    const title = String(formData.get("title") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    if (!title) return fail("Le titre est obligatoire.");
    if (!content) return fail("Le contenu est obligatoire.");

    // Cible : toute la division (null) ou une sous-unité précise appartenant à
    // cette division.
    const subDivisionId = Number(formData.get("subDivisionId")) || null;
    if (subDivisionId) {
      const sub = await db.subDivision.findUnique({
        where: { id: subDivisionId },
      });
      if (!sub || sub.divisionId !== division.id) {
        return fail("La sous-unité choisie n'appartient pas à cette division.");
      }
    }

    const doc = await db.divisionDocument.create({
      data: {
        divisionId: division.id,
        subDivisionId,
        title,
        content,
        fileUrl: text(formData.get("fileUrl")),
        authorId: user.id,
      },
    });

    await audit({
      userId: user.id,
      action: "DIVISION_DOC_CREATE",
      targetType: "Division",
      targetId: division.id,
      detail: `${code} — ${title}`,
    });

    revalidatePath(`/divisions/${code}/documents`);
    return { success: "Document diffusé." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deleteDivisionDocument(formData: FormData) {
  const code = String(formData.get("code") ?? "").toUpperCase();
  const user = await assertPermission((u) => canManageDivisionDocs(u, code));
  const id = Number(formData.get("documentId"));

  const doc = await db.divisionDocument.findUnique({ where: { id } });
  if (!doc) throw new Error("Document introuvable.");

  await db.divisionDocument.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "DIVISION_DOC_DELETE",
    targetType: "Division",
    targetId: doc.divisionId,
    detail: `${code} — ${doc.title}`,
  });

  revalidatePath(`/divisions/${code}/documents`);
}
