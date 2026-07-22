"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { canAccessInvestigations, isDepartmentHead } from "@/lib/permissions";

export type InvState = { error?: string; success?: string } | undefined;

const fail = (error: string): InvState => ({ error });

/**
 * Une enquête archivée est gelée : plus aucun rattachement de rapport, entrée
 * de journal ou élément d'information. Seul le Chief of Police peut encore la
 * supprimer définitivement (ou la rouvrir via un changement de statut).
 */
async function assertNotArchived(investigationId: number) {
  const inv = await db.investigation.findUnique({
    where: { id: investigationId },
    select: { status: true },
  });
  if (!inv) throw new Error("Enquête introuvable.");
  if (inv.status === "ARCHIVED") {
    throw new Error("Cette enquête est archivée : elle est en lecture seule.");
  }
}

async function nextReference() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const last = await db.investigation.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const seq = last ? Number(last.reference.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function createInvestigation(
  _state: InvState,
  formData: FormData,
): Promise<InvState> {
  let newId: number;
  try {
    const user = await assertPermission(canAccessInvestigations);
    const title = String(formData.get("title") ?? "").trim();
    const summary = String(formData.get("summary") ?? "").trim();
    if (!title) return fail("Le titre de l'enquête est obligatoire.");
    if (!summary) return fail("Le résumé est obligatoire.");

    const investigation = await db.investigation.create({
      data: { reference: await nextReference(), leadId: user.id, title, summary },
    });
    newId = investigation.id;

    await audit({
      userId: user.id,
      action: "INVESTIGATION_CREATE",
      targetType: "Investigation",
      targetId: investigation.id,
      detail: investigation.reference,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }

  revalidatePath("/investigations");
  redirect(`/investigations/${newId}`);
}

export async function addInvestigationNote(
  _state: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    const user = await assertPermission(canAccessInvestigations);
    const investigationId = Number(formData.get("investigationId"));
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return fail("La note est vide.");
    await assertNotArchived(investigationId);

    await db.investigationNote.create({
      data: { investigationId, authorId: user.id, body },
    });

    await audit({
      userId: user.id,
      action: "INVESTIGATION_NOTE",
      targetType: "Investigation",
      targetId: investigationId,
    });

    revalidatePath(`/investigations/${investigationId}`);
    return { success: "Note ajoutée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function linkReport(
  _state: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    const user = await assertPermission(canAccessInvestigations);
    const investigationId = Number(formData.get("investigationId"));
    const reportId = Number(formData.get("reportId"));
    if (!reportId) return fail("Sélectionnez un rapport.");
    await assertNotArchived(investigationId);

    const existing = await db.investigationReport.findUnique({
      where: { investigationId_reportId: { investigationId, reportId } },
    });
    if (existing) return fail("Ce rapport est déjà rattaché à l'enquête.");

    await db.investigationReport.create({ data: { investigationId, reportId } });

    await audit({
      userId: user.id,
      action: "INVESTIGATION_LINK_REPORT",
      targetType: "Investigation",
      targetId: investigationId,
      detail: `Rapport #${reportId}`,
    });

    revalidatePath(`/investigations/${investigationId}`);
    return { success: "Rapport rattaché." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function unlinkReport(formData: FormData) {
  const user = await assertPermission(canAccessInvestigations);
  const investigationId = Number(formData.get("investigationId"));
  const reportId = Number(formData.get("reportId"));

  await db.investigationReport.delete({
    where: { investigationId_reportId: { investigationId, reportId } },
  });
  await audit({
    userId: user.id,
    action: "INVESTIGATION_UNLINK_REPORT",
    targetType: "Investigation",
    targetId: investigationId,
    detail: `Rapport #${reportId}`,
  });

  revalidatePath(`/investigations/${investigationId}`);
}

export async function updateInvestigationStatus(formData: FormData) {
  const user = await assertPermission(canAccessInvestigations);
  const investigationId = Number(formData.get("investigationId"));
  const status = String(formData.get("status") ?? "");
  const closed = status === "CLOSED" || status === "ARCHIVED";

  await db.investigation.update({
    where: { id: investigationId },
    data: { status, closedAt: closed ? new Date() : null },
  });
  await audit({
    userId: user.id,
    action: "INVESTIGATION_STATUS",
    targetType: "Investigation",
    targetId: investigationId,
    detail: status,
  });

  revalidatePath(`/investigations/${investigationId}`);
  revalidatePath("/investigations");
}

export async function addInvestigationInfo(
  _state: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    const user = await assertPermission(canAccessInvestigations);
    const investigationId = Number(formData.get("investigationId"));
    const label = String(formData.get("label") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    if (!label) return fail("Un intitulé est requis.");
    if (!content) return fail("Le détail de l'information est vide.");
    await assertNotArchived(investigationId);

    await db.investigationInfo.create({
      data: { investigationId, authorId: user.id, label, content },
    });

    await audit({
      userId: user.id,
      action: "INVESTIGATION_INFO_ADD",
      targetType: "Investigation",
      targetId: investigationId,
      detail: label,
    });

    revalidatePath(`/investigations/${investigationId}`);
    return { success: "Information ajoutée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deleteInvestigationInfo(formData: FormData) {
  const user = await assertPermission(canAccessInvestigations);
  const id = Number(formData.get("infoId"));
  const info = await db.investigationInfo.findUnique({ where: { id } });
  if (!info) throw new Error("Information introuvable.");
  await assertNotArchived(info.investigationId);

  await db.investigationInfo.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "INVESTIGATION_INFO_DELETE",
    targetType: "Investigation",
    targetId: info.investigationId,
    detail: info.label,
  });

  revalidatePath(`/investigations/${info.investigationId}`);
}

/**
 * Suppression définitive d'une enquête — réservée au Chief of Police et
 * possible uniquement sur une enquête archivée.
 */
export async function deleteInvestigation(formData: FormData) {
  const user = await assertPermission(
    isDepartmentHead,
    "Seul le Chief of Police peut supprimer une enquête.",
  );
  const investigationId = Number(formData.get("investigationId"));

  const inv = await db.investigation.findUnique({
    where: { id: investigationId },
    select: { reference: true, status: true },
  });
  if (!inv) throw new Error("Enquête introuvable.");
  if (inv.status !== "ARCHIVED") {
    throw new Error("Seule une enquête archivée peut être supprimée.");
  }

  await db.investigation.delete({ where: { id: investigationId } });
  await audit({
    userId: user.id,
    action: "INVESTIGATION_DELETE",
    targetType: "Investigation",
    targetId: investigationId,
    detail: inv.reference,
  });

  revalidatePath("/investigations");
  redirect("/investigations");
}
