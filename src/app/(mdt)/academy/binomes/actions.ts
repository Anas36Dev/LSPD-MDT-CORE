"use server";

import { revalidatePath } from "@/lib/revalidate";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { canManageBinomes, RANK } from "@/lib/permissions";

export type BinomeState = { error?: string; success?: string } | undefined;

const fail = (error: string): BinomeState => ({ error });

const VISIBILITIES = ["BOTH", "ROOKIE", "INSTRUCTOR", "PUBLIC"];

export async function createPartnership(
  _state: BinomeState,
  formData: FormData,
): Promise<BinomeState> {
  try {
    const actor = await assertPermission(canManageBinomes);
    const rookieId = Number(formData.get("rookieId"));
    const instructorId = Number(formData.get("instructorId"));
    if (!rookieId || !instructorId) {
      return fail("Sélectionnez une recrue et un instructeur.");
    }

    // La recrue est forcément un Police Officer I.
    const rookie = await db.user.findUnique({
      where: { id: rookieId },
      select: { rank: { select: { level: true } } },
    });
    if (!rookie || rookie.rank.level !== RANK.POLICE_OFFICER_I) {
      return fail("La recrue doit être un Police Officer I.");
    }

    // L'instructeur est forcément un Field Training Officer.
    const instructor = await db.user.findFirst({
      where: {
        id: instructorId,
        divisionRoles: { some: { divisionRole: { code: "TD_FTO" } } },
      },
      select: { id: true },
    });
    if (!instructor) {
      return fail("L'instructeur doit avoir le rôle Field Training Officer.");
    }

    const clash = await db.partnership.findFirst({
      where: { OR: [{ rookieId }, { instructorId }] },
    });
    if (clash) {
      return fail(
        clash.rookieId === rookieId
          ? "Cette recrue est déjà en binôme."
          : "Cet instructeur est déjà en binôme.",
      );
    }

    const p = await db.partnership.create({
      data: { rookieId, instructorId, createdById: actor.id },
    });

    await audit({
      userId: actor.id,
      action: "PARTNERSHIP_CREATE",
      targetType: "Partnership",
      targetId: p.id,
    });

    revalidatePath("/academy/binomes");
    return { success: "Binôme créé." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deletePartnership(formData: FormData) {
  const actor = await assertPermission(canManageBinomes);
  const id = Number(formData.get("partnershipId"));

  await db.partnership.delete({ where: { id } });
  await audit({
    userId: actor.id,
    action: "PARTNERSHIP_DELETE",
    targetType: "Partnership",
    targetId: id,
  });

  revalidatePath("/academy/binomes");
}

export async function addPartnershipNote(
  _state: BinomeState,
  formData: FormData,
): Promise<BinomeState> {
  try {
    const actor = await assertPermission(canManageBinomes);
    const partnershipId = Number(formData.get("partnershipId"));
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return fail("La note est vide.");

    const visibility = String(formData.get("visibility") ?? "BOTH");
    if (!VISIBILITIES.includes(visibility)) return fail("Visibilité invalide.");

    await db.partnershipNote.create({
      data: { partnershipId, authorId: actor.id, body, visibility },
    });

    await audit({
      userId: actor.id,
      action: "PARTNERSHIP_NOTE",
      targetType: "Partnership",
      targetId: partnershipId,
    });

    revalidatePath("/academy/binomes");
    return { success: "Note ajoutée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}
