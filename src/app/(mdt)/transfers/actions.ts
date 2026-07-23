"use server";

import { revalidatePath } from "@/lib/revalidate";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { notify, notifyMany } from "@/lib/notify";
import {
  can,
  DIVISION_MIN_LEVEL,
  isDepartmentHead,
  isSworn,
} from "@/lib/permissions";

export type TransferState = { error?: string; success?: string } | undefined;

const fail = (error: string): TransferState => ({ error });

export async function applyForTransfer(
  _state: TransferState,
  formData: FormData,
): Promise<TransferState> {
  try {
    const user = await assertPermission(isSworn);

    // Fiche circulaire 1.1 § 3 : les divisions sont réservées au grade
    // d'Officier II et au-dessus. Inutile de laisser candidater en dessous.
    if (!user.isSuperAdmin && user.rank.level < DIVISION_MIN_LEVEL) {
      return fail(
        `Les divisions sont accessibles à partir du grade de Police Officer II. Votre grade actuel (${user.rank.name}) ne permet pas de candidater.`,
      );
    }

    const divisionId = Number(formData.get("divisionId"));
    const motivation = String(formData.get("motivation") ?? "").trim();

    if (!divisionId) return fail("Sélectionnez une division.");
    if (motivation.length < 20) {
      return fail("Développez votre motivation (20 caractères minimum).");
    }

    const division = await db.division.findUnique({ where: { id: divisionId } });
    if (!division) return fail("Division introuvable.");

    const already = await db.userDivision.findUnique({
      where: { userId_divisionId: { userId: user.id, divisionId } },
    });
    if (already) return fail(`Vous appartenez déjà à ${division.name}.`);

    const pending = await db.transferRequest.findFirst({
      where: { applicantId: user.id, divisionId, status: "PENDING" },
    });
    if (pending) {
      return fail("Une candidature est déjà en cours pour cette division.");
    }

    const request = await db.transferRequest.create({
      data: {
        applicantId: user.id,
        divisionId,
        subDivisionId: Number(formData.get("subDivisionId")) || null,
        motivation,
      },
    });

    await audit({
      userId: user.id,
      action: "TRANSFER_APPLY",
      targetType: "TransferRequest",
      targetId: request.id,
      detail: division.name,
    });

    // Le chef de la division et ses instructeurs sont prévenus de la
    // candidature déposée dans leur propre division.
    const supervisors = await db.user.findMany({
      where: {
        divisionRoles: {
          some: {
            divisionRole: {
              divisionId,
              OR: [{ isDivisionChief: true }, { canTrain: true }],
            },
          },
        },
      },
      select: { id: true },
    });
    await notifyMany(
      supervisors.map((s) => s.id),
      {
        type: "TRANSFER_APPLY",
        title: `Nouvelle candidature — ${division.name}`,
        body: `${user.rank.name} ${user.firstName} ${user.lastName} candidate à ${division.name}.`,
        link: "/transfers",
      },
    );

    revalidatePath("/transfers");
    return { success: `Candidature déposée pour ${division.name}.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function decideTransfer(
  _state: TransferState,
  formData: FormData,
): Promise<TransferState> {
  try {
    const id = Number(formData.get("id"));
    const decision = String(formData.get("decision"));
    const note = String(formData.get("decisionNote") ?? "").trim();

    if (!["ACCEPTED", "REJECTED"].includes(decision)) {
      return fail("Décision invalide.");
    }

    const request = await db.transferRequest.findUnique({ where: { id } });
    if (!request) return fail("Candidature introuvable.");
    if (request.status !== "PENDING") {
      return fail("Cette candidature a déjà été traitée.");
    }

    const division = await db.division.findUniqueOrThrow({
      where: { id: request.divisionId },
    });

    // Seuls le Command Staff et le chef de la division concernée décident.
    const user = await assertPermission((u) =>
      can.decideTransfer(u, division.code),
    );

    if (decision === "REJECTED" && !note) {
      return fail("Un refus doit être motivé.");
    }

    await db.transferRequest.update({
      where: { id },
      data: {
        status: decision,
        decisionNote: note || null,
        decidedById: user.id,
        decidedAt: new Date(),
      },
    });

    // L'acceptation vaut affectation : sans cela, il faudrait repasser par la
    // gestion des comptes et la décision resterait sans effet.
    if (decision === "ACCEPTED") {
      const existing = await db.userDivision.findMany({
        where: { userId: request.applicantId },
      });

      await db.userDivision.upsert({
        where: {
          userId_divisionId: {
            userId: request.applicantId,
            divisionId: request.divisionId,
          },
        },
        update: {},
        create: {
          userId: request.applicantId,
          divisionId: request.divisionId,
          isPrimary: existing.length === 0,
        },
      });

      if (request.subDivisionId) {
        await db.userSubDivision.upsert({
          where: {
            userId_subDivisionId: {
              userId: request.applicantId,
              subDivisionId: request.subDivisionId,
            },
          },
          update: {},
          create: {
            userId: request.applicantId,
            subDivisionId: request.subDivisionId,
          },
        });
      }
    }

    await audit({
      userId: user.id,
      action: `TRANSFER_${decision}`,
      targetType: "TransferRequest",
      targetId: id,
      detail: `${division.name}${note ? ` — ${note}` : ""}`,
    });

    await notify(request.applicantId, {
      type: `TRANSFER_${decision}`,
      title:
        decision === "ACCEPTED"
          ? `Candidature acceptée — ${division.name}`
          : `Candidature refusée — ${division.name}`,
      body:
        decision === "ACCEPTED"
          ? `Vous êtes désormais affecté à ${division.name}.`
          : note || `Votre candidature à ${division.name} a été refusée.`,
      link: "/transfers",
    });

    revalidatePath("/transfers");
    revalidatePath("/roster");
    return {
      success:
        decision === "ACCEPTED"
          ? `Candidature acceptée. L'agent est affecté à ${division.name}.`
          : "Candidature refusée.",
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function withdrawTransfer(formData: FormData) {
  const user = await assertPermission(isSworn);
  const id = Number(formData.get("id"));

  await db.transferRequest.updateMany({
    where: { id, applicantId: user.id, status: "PENDING" },
    data: { status: "WITHDRAWN" },
  });

  revalidatePath("/transfers");
}

/** Suppression définitive d'une demande de mutation — Chief of Police seul. */
export async function deleteTransfer(formData: FormData) {
  const actor = await assertPermission(
    isDepartmentHead,
    "Seul le Chief of Police peut supprimer une demande de mutation.",
  );
  const id = Number(formData.get("id"));

  const request = await db.transferRequest.findUnique({ where: { id } });
  if (!request) throw new Error("Demande introuvable.");

  await db.transferRequest.delete({ where: { id } });
  await audit({
    userId: actor.id,
    action: "TRANSFER_DELETE",
    targetType: "TransferRequest",
    targetId: id,
  });

  revalidatePath("/transfers");
}
