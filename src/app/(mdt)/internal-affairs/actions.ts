"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { can } from "@/lib/permissions";

export type IaState = { error?: string; success?: string } | undefined;

const fail = (error: string): IaState => ({ error });

/** IA-2026-0042 */
async function nextReference() {
  const year = new Date().getFullYear();
  const prefix = `IA-${year}-`;

  const last = await db.iaCase.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  const seq = last ? Number(last.reference.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Dossiers
// ---------------------------------------------------------------------------

export async function openCase(
  _state: IaState,
  formData: FormData,
): Promise<IaState> {
  let caseId: number;

  try {
    const user = await assertPermission(can.viewIaCases);

    const subjectId = Number(formData.get("subjectId"));
    const title = String(formData.get("title") ?? "").trim();
    const summary = String(formData.get("summary") ?? "").trim();

    if (!subjectId) return fail("Sélectionnez l'agent mis en cause.");
    if (!title) return fail("L'objet du dossier est obligatoire.");
    if (!summary) return fail("Le résumé des faits est obligatoire.");

    if (subjectId === user.id && !user.isSuperAdmin) {
      return fail("Vous ne pouvez pas ouvrir un dossier vous concernant.");
    }

    const subject = await db.user.findUnique({
      where: { id: subjectId },
      select: { firstName: true, lastName: true, badgeNumber: true },
    });
    if (!subject) return fail("Agent introuvable.");

    const iaCase = await db.iaCase.create({
      data: {
        reference: await nextReference(),
        subjectId,
        investigatorId: user.id,
        title,
        summary,
        severity: String(formData.get("severity") ?? "MEDIUM"),
      },
    });
    caseId = iaCase.id;

    await audit({
      userId: user.id,
      action: "IA_CASE_OPEN",
      targetType: "IaCase",
      targetId: iaCase.id,
      detail: `${iaCase.reference} — ${subject.firstName} ${subject.lastName} #${subject.badgeNumber}`,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }

  revalidatePath("/internal-affairs");
  redirect(`/internal-affairs/${caseId}`);
}

export async function addNote(
  _state: IaState,
  formData: FormData,
): Promise<IaState> {
  try {
    const user = await assertPermission(can.viewIaCases);
    const caseId = Number(formData.get("caseId"));
    const body = String(formData.get("body") ?? "").trim();

    if (!body) return fail("La note est vide.");

    const iaCase = await db.iaCase.findUnique({ where: { id: caseId } });
    if (!iaCase) return fail("Dossier introuvable.");
    if (iaCase.status === "CLOSED" || iaCase.status === "DISMISSED") {
      return fail("Ce dossier est clos : il n'accepte plus de note.");
    }

    await db.iaCaseNote.create({
      data: { caseId, authorId: user.id, body },
    });

    // Une première note fait passer le dossier en cours d'instruction.
    if (iaCase.status === "OPEN") {
      await db.iaCase.update({
        where: { id: caseId },
        data: { status: "INVESTIGATING" },
      });
    }

    await audit({
      userId: user.id,
      action: "IA_CASE_NOTE",
      targetType: "IaCase",
      targetId: caseId,
      detail: iaCase.reference,
    });

    revalidatePath(`/internal-affairs/${caseId}`);
    return { success: "Note ajoutée au dossier." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function closeCase(
  _state: IaState,
  formData: FormData,
): Promise<IaState> {
  try {
    // La clôture est le seul acte réservé au Chief of Internal Affairs
    // Division — un inspecteur instruit, il ne conclut pas.
    const user = await assertPermission(can.closeIaCase);

    const caseId = Number(formData.get("caseId"));
    const outcome = String(formData.get("outcome") ?? "").trim();
    const status = String(formData.get("status") ?? "CLOSED");

    if (!outcome) return fail("Les conclusions sont obligatoires.");
    if (!["CLOSED", "DISMISSED"].includes(status)) {
      return fail("Décision invalide.");
    }

    const iaCase = await db.iaCase.findUnique({ where: { id: caseId } });
    if (!iaCase) return fail("Dossier introuvable.");
    if (iaCase.status === "CLOSED" || iaCase.status === "DISMISSED") {
      return fail("Ce dossier est déjà clos.");
    }

    await db.iaCase.update({
      where: { id: caseId },
      data: { status, outcome, closedAt: new Date() },
    });

    await audit({
      userId: user.id,
      action: status === "DISMISSED" ? "IA_CASE_DISMISS" : "IA_CASE_CLOSE",
      targetType: "IaCase",
      targetId: caseId,
      detail: `${iaCase.reference} — ${outcome.slice(0, 120)}`,
    });

    revalidatePath(`/internal-affairs/${caseId}`);
    revalidatePath("/internal-affairs");
    return {
      success:
        status === "DISMISSED"
          ? "Dossier classé sans suite."
          : "Dossier clos.",
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

// ---------------------------------------------------------------------------
// Sanctions
// ---------------------------------------------------------------------------

export async function issueSanction(
  _state: IaState,
  formData: FormData,
): Promise<IaState> {
  try {
    const user = await assertPermission(can.closeIaCase);

    const caseId = Number(formData.get("caseId")) || null;
    const subjectId = Number(formData.get("subjectId"));
    const type = String(formData.get("type") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();

    if (!subjectId) return fail("Agent introuvable.");
    if (!type) return fail("Sélectionnez le type de sanction.");
    if (!reason) return fail("Le motif de la sanction est obligatoire.");

    const endsAtRaw = String(formData.get("endsAt") ?? "").trim();

    await db.sanction.create({
      data: {
        subjectId,
        caseId,
        type,
        reason,
        isPublic: formData.get("isPublic") === "on",
        endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
      },
    });

    // Une suspension ou une révocation doit se traduire immédiatement sur le
    // compte : sans cela, l'agent sanctionné garderait l'accès au terminal.
    if (type === "SUSPENSION") {
      await db.user.update({
        where: { id: subjectId },
        data: { status: "SUSPENDED" },
      });
      await db.session.deleteMany({ where: { userId: subjectId } });
    } else if (type === "TERMINATION") {
      await db.user.update({
        where: { id: subjectId },
        data: { status: "DISCHARGED" },
      });
      await db.session.deleteMany({ where: { userId: subjectId } });
    }

    await audit({
      userId: user.id,
      action: "IA_SANCTION",
      targetType: "User",
      targetId: subjectId,
      detail: `${type} — ${reason.slice(0, 120)}`,
    });

    if (caseId) revalidatePath(`/internal-affairs/${caseId}`);
    revalidatePath(`/roster/${subjectId}`);
    revalidatePath("/roster");
    return { success: "Sanction prononcée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function liftSanction(formData: FormData) {
  const user = await assertPermission(can.closeIaCase);
  const id = Number(formData.get("sanctionId"));

  const sanction = await db.sanction.findUnique({ where: { id } });
  if (!sanction) throw new Error("Sanction introuvable.");

  await db.sanction.delete({ where: { id } });

  // Lever une suspension rétablit l'accès ; une révocation reste définitive
  // et se rétablit depuis la gestion des comptes, en pleine conscience.
  if (sanction.type === "SUSPENSION") {
    await db.user.update({
      where: { id: sanction.subjectId },
      data: { status: "ACTIVE" },
    });
  }

  await audit({
    userId: user.id,
    action: "IA_SANCTION_LIFT",
    targetType: "User",
    targetId: sanction.subjectId,
    detail: sanction.type,
  });

  revalidatePath(`/roster/${sanction.subjectId}`);
  if (sanction.caseId) revalidatePath(`/internal-affairs/${sanction.caseId}`);
}
