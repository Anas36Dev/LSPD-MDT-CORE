"use server";

import { revalidatePath } from "@/lib/revalidate";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { can, isCommandStaff, isDepartmentHead } from "@/lib/permissions";

export type SanctionState = { error?: string; success?: string } | undefined;

const SANCTION_TYPES = [
  "WARNING",
  "REPRIMAND",
  "SUSPENSION",
  "DEMOTION",
  "TERMINATION",
];

/**
 * Officialise un Police Officer I en Police Officer II.
 *
 * C'est la sortie de période probatoire : un agent quitte le statut de
 * Probationary Officer pour entrer dans l'Executive Staff. Réservé aux
 * superviseurs et aux instructeurs de l'académie.
 */
export async function officializeOfficer(formData: FormData) {
  const actor = await assertPermission(can.officialize);
  const id = Number(formData.get("userId"));

  const target = await db.user.findUnique({
    where: { id },
    include: { rank: true },
  });
  if (!target) throw new Error("Agent introuvable.");

  if (target.rank.code !== "POLICE_OFFICER_I") {
    throw new Error(
      "Seul un Police Officer I (Probationary Officer) peut être officialisé.",
    );
  }

  const po2 = await db.rank.findUniqueOrThrow({
    where: { code: "POLICE_OFFICER_II" },
  });

  await db.user.update({ where: { id }, data: { rankId: po2.id } });

  await audit({
    userId: actor.id,
    action: "OFFICER_OFFICIALIZE",
    targetType: "User",
    targetId: id,
    detail: `${target.firstName} ${target.lastName} — Police Officer I → Police Officer II`,
  });

  revalidatePath(`/roster/${id}`);
  revalidatePath("/roster");
}

/**
 * Sanction directe prononcée par le Command Staff, sans passer par un dossier
 * des Affaires internes. La sanction est enregistrée au dossier disciplinaire
 * de l'agent (sans `caseId`) et, pour une suspension/révocation, coupe l'accès.
 */
export async function issueDirectSanction(
  _state: SanctionState,
  formData: FormData,
): Promise<SanctionState> {
  try {
    const actor = await assertPermission(isCommandStaff);
    const subjectId = Number(formData.get("subjectId"));
    const type = String(formData.get("type") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();

    if (!subjectId) return { error: "Agent introuvable." };
    if (!SANCTION_TYPES.includes(type)) {
      return { error: "Sélectionnez le type de sanction." };
    }
    if (!reason) return { error: "Le motif de la sanction est obligatoire." };
    if (subjectId === actor.id) {
      return { error: "Vous ne pouvez pas vous sanctionner vous-même." };
    }

    const subject = await db.user.findUnique({
      where: { id: subjectId },
      include: { rank: true },
    });
    if (!subject) return { error: "Agent introuvable." };
    if (subject.isSuperAdmin) {
      return { error: "Le compte technique ne peut pas être sanctionné." };
    }
    // Anti-lockout : hors chef du département, on ne sanctionne qu'un grade
    // strictement inférieur au sien.
    if (!isDepartmentHead(actor) && subject.rank.level >= actor.rank.level) {
      return {
        error:
          "Vous ne pouvez sanctionner qu'un agent de grade inférieur au vôtre.",
      };
    }

    const endsAtRaw = String(formData.get("endsAt") ?? "").trim();

    await db.sanction.create({
      data: {
        subjectId,
        caseId: null,
        type,
        reason,
        isPublic: formData.get("isPublic") === "on",
        endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
      },
    });

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
      userId: actor.id,
      action: "SANCTION_DIRECT",
      targetType: "User",
      targetId: subjectId,
      detail: `${type} — ${reason.slice(0, 120)}`,
    });

    revalidatePath(`/roster/${subjectId}`);
    revalidatePath("/roster");
    return { success: "Sanction prononcée." };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Erreur inattendue.",
    };
  }
}
