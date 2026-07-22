"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import {
  canManagePromotions,
  canSuperviseAcademy,
} from "@/lib/permissions";
import { PASS_THRESHOLD } from "./constants";

export type AcademyState = { error?: string; success?: string } | undefined;

const fail = (error: string): AcademyState => ({ error });

export async function recordExam(
  _state: AcademyState,
  formData: FormData,
): Promise<AcademyState> {
  try {
    const examiner = await assertPermission(canSuperviseAcademy);
    const candidateId = Number(formData.get("candidateId"));
    if (!candidateId) return fail("Candidat introuvable.");

    const subjects = await db.academyExamSubject.findMany({
      orderBy: { order: "asc" },
    });
    if (subjects.length === 0) return fail("Aucun barème n'est configuré.");

    // Chaque épreuve est notée dans la limite de son barème.
    const scores: { subjectId: number; points: number }[] = [];
    for (const s of subjects) {
      const raw = Number(formData.get(`score_${s.id}`)) || 0;
      const points = Math.max(0, Math.min(s.maxPoints, Math.round(raw)));
      scores.push({ subjectId: s.id, points });
    }

    const totalPoints = scores.reduce((sum, s) => sum + s.points, 0);
    const maxPoints = subjects.reduce((sum, s) => sum + s.maxPoints, 0);
    const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
    const passed = percentage >= PASS_THRESHOLD;

    await db.academyExam.create({
      data: {
        candidateId,
        examinerId: examiner.id,
        totalPoints,
        maxPoints,
        percentage,
        passed,
        comment: String(formData.get("comment") ?? "").trim() || null,
        scores: { create: scores },
      },
    });

    await audit({
      userId: examiner.id,
      action: "ACADEMY_EXAM_RECORD",
      targetType: "User",
      targetId: candidateId,
      detail: `${percentage}% — ${passed ? "admis" : "ajourné"}`,
    });

    revalidatePath(`/academy/supervision/${candidateId}`);
    revalidatePath("/academy/supervision");
    return {
      success: `Examen enregistré : ${percentage}% — ${passed ? "admis" : "ajourné"}.`,
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

// ---------------------------------------------------------------------------
// Promotions académiques
// ---------------------------------------------------------------------------

export async function createPromotion(
  _state: AcademyState,
  formData: FormData,
): Promise<AcademyState> {
  try {
    const user = await assertPermission(canManagePromotions);
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return fail("Le nom de la promotion est obligatoire.");

    const existing = await db.academyPromotion.findUnique({ where: { name } });
    if (existing) return fail("Cette promotion existe déjà.");

    await db.academyPromotion.create({ data: { name } });
    await audit({
      userId: user.id,
      action: "PROMOTION_CREATE",
      targetType: "AcademyPromotion",
      detail: name,
    });

    revalidatePath("/academy/supervision");
    return { success: `Promotion « ${name} » créée.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deletePromotion(formData: FormData) {
  const user = await assertPermission(canManagePromotions);
  const id = Number(formData.get("promotionId"));
  const promo = await db.academyPromotion.findUnique({ where: { id } });
  if (!promo) throw new Error("Promotion introuvable.");

  // Les Rookies déjà affectés conservent le nom ; la promotion disparaît de la
  // liste de sélection.
  await db.academyPromotion.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "PROMOTION_DELETE",
    targetType: "AcademyPromotion",
    detail: promo.name,
  });

  revalidatePath("/academy/supervision");
}

export async function assignPromotion(formData: FormData) {
  const user = await assertPermission(canSuperviseAcademy);
  const rookieId = Number(formData.get("rookieId"));
  const promotion = String(formData.get("promotion") ?? "").trim() || null;

  await db.user.update({
    where: { id: rookieId },
    data: { promotion },
  });
  await audit({
    userId: user.id,
    action: "PROMOTION_ASSIGN",
    targetType: "User",
    targetId: rookieId,
    detail: promotion ?? "Sans promotion",
  });

  revalidatePath("/academy/supervision");
}

/**
 * Validation de sortie d'académie : promeut un Rookie admis (examen ≥ 80 %)
 * au grade de Police Officer I et l'affecte à la Patrol Division.
 */
export async function graduateRookie(formData: FormData) {
  const actor = await assertPermission(canSuperviseAcademy);
  const rookieId = Number(formData.get("rookieId"));

  const passed = await db.academyExam.findFirst({
    where: { candidateId: rookieId, passed: true },
  });
  if (!passed) {
    throw new Error("Le Rookie doit avoir réussi l'examen (≥ 80 %) pour sortir.");
  }

  const [poI, patrol] = await Promise.all([
    db.rank.findFirst({ where: { level: 37 } }), // Police Officer I
    db.division.findUnique({ where: { code: "PATROL" } }),
  ]);
  if (!poI) throw new Error("Grade Police Officer I introuvable.");

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: rookieId }, data: { rankId: poI.id } });
    if (patrol) {
      await tx.userDivision.upsert({
        where: { userId_divisionId: { userId: rookieId, divisionId: patrol.id } },
        create: { userId: rookieId, divisionId: patrol.id, isPrimary: true },
        update: {},
      });
    }
  });

  await audit({
    userId: actor.id,
    action: "ACADEMY_GRADUATE",
    targetType: "User",
    targetId: rookieId,
    detail: "Sortie d'académie → Police Officer I",
  });

  revalidatePath("/academy/supervision");
  revalidatePath(`/academy/supervision/${rookieId}`);
  revalidatePath("/roster");
}

export async function addEvaluation(
  _state: AcademyState,
  formData: FormData,
): Promise<AcademyState> {
  try {
    const instructor = await assertPermission(canSuperviseAcademy);
    const traineeId = Number(formData.get("traineeId"));
    const comment = String(formData.get("comment") ?? "").trim();
    if (!comment) return fail("Le commentaire est vide.");

    await db.traineeEvaluation.create({
      data: { traineeId, instructorId: instructor.id, comment },
    });

    await audit({
      userId: instructor.id,
      action: "ACADEMY_EVALUATION",
      targetType: "User",
      targetId: traineeId,
    });

    revalidatePath(`/academy/supervision/${traineeId}`);
    return { success: "Observation enregistrée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}
