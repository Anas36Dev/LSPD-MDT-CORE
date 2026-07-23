"use server";

import { revalidatePath } from "@/lib/revalidate";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { can, canMoveAgent, isSworn, type SessionUser } from "@/lib/permissions";

export type DispatchState = { error?: string; success?: string } | undefined;

const fail = (error: string): DispatchState => ({ error });

const PATROL_STATUSES = ["AVAILABLE", "BUSY", "ON_SCENE", "RETURNING"] as const;

// ---------------------------------------------------------------------------
// Patrouilles
// ---------------------------------------------------------------------------

export async function createPatrol(
  _state: DispatchState,
  formData: FormData,
): Promise<DispatchState> {
  try {
    // Le dispatch crée et gère toutes les unités. À partir de Police Officer I,
    // un agent peut créer sa propre patrouille (une seule) et s'y placer.
    const actor = await assertPermission(isSworn);
    const selfService = !can.manageDispatch(actor);

    const callSign = String(formData.get("callSign") ?? "").trim().toUpperCase();
    const number = String(formData.get("number") ?? "").trim();

    if (!callSign) return fail("Sélectionnez un call sign.");
    if (!number) return fail("Le numéro d'unité est obligatoire.");

    // « Une seule patrouille » : un agent hors dispatch ne peut en créer une
    // que s'il n'est pas déjà affecté à une patrouille.
    if (selfService) {
      const existing = await db.patrolMember.findUnique({
        where: { userId: actor.id },
      });
      if (existing) {
        return fail(
          "Vous êtes déjà dans une patrouille. Quittez-la avant d'en créer une autre.",
        );
      }
    }

    const patrol = await db.patrol.create({
      data: {
        callSign,
        number: number || null,
        sector: String(formData.get("sector") ?? "").trim() || null,
        createdById: actor.id,
        // L'agent qui crée sa patrouille y est directement placé, chef de bord.
        ...(selfService
          ? { members: { create: { userId: actor.id, isLead: true } } }
          : {}),
      },
    });

    await audit({
      userId: actor.id,
      action: "PATROL_CREATE",
      targetType: "Patrol",
      targetId: patrol.id,
      detail: `${callSign}${number ? `-${number}` : ""}`,
    });

    revalidatePath("/dispatch");
    return { success: `Patrouille ${callSign}${number ? `-${number}` : ""} créée.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deletePatrol(formData: FormData) {
  const actor = await assertPermission(isSworn);
  const id = Number(formData.get("patrolId"));

  const patrol = await db.patrol.findUnique({ where: { id } });
  if (!patrol) throw new Error("Patrouille introuvable.");

  // Le dispatch dissout n'importe quelle unité ; un agent ne peut dissoudre
  // que la patrouille qu'il a lui-même créée.
  if (!can.manageDispatch(actor) && patrol.createdById !== actor.id) {
    throw new Error("Vous ne pouvez dissoudre que votre propre patrouille.");
  }

  // Les affectations partent en cascade : les agents retournent au pool.
  await db.patrol.delete({ where: { id } });

  await audit({
    userId: actor.id,
    action: "PATROL_DELETE",
    targetType: "Patrol",
    targetId: id,
    detail: `${patrol.callSign}${patrol.number ? `-${patrol.number}` : ""}`,
  });

  revalidatePath("/dispatch");
}

/**
 * Réordonne les patrouilles sur le tableau (glisser-déposer).
 *
 * Réservé au dispatch : Watch Commander, Assistant Watch Commander et Command
 * Staff — les mêmes qui déplacent les cartes.
 */
export async function reorderPatrols(ids: number[]) {
  const actor = await assertPermission(can.manageDispatch);

  await db.$transaction(
    ids.map((id, index) =>
      db.patrol.update({ where: { id }, data: { order: index } }),
    ),
  );

  await audit({
    userId: actor.id,
    action: "PATROL_REORDER",
    targetType: "Patrol",
  });

  revalidatePath("/dispatch");
}

/**
 * Met à jour le statut et/ou le secteur d'une patrouille.
 *
 * Modifiable par le dispatch, ou par un membre de la patrouille concernée.
 */
export async function updatePatrol(formData: FormData) {
  const actor = await assertPermission(isSworn);
  const id = Number(formData.get("patrolId"));

  const patrol = await db.patrol.findUnique({
    where: { id },
    include: { members: { select: { userId: true } } },
  });
  if (!patrol) throw new Error("Patrouille introuvable.");

  if (!can.manageDispatch(actor)) {
    const isMember = patrol.members.some((m) => m.userId === actor.id);
    if (!isMember) {
      throw new Error("Vous ne pouvez modifier que votre propre patrouille.");
    }
  }

  const data: { status?: string; sector?: string | null } = {};

  const status = formData.get("status");
  if (typeof status === "string" && status) {
    if (!PATROL_STATUSES.includes(status as (typeof PATROL_STATUSES)[number])) {
      throw new Error("Statut invalide.");
    }
    data.status = status;
  }

  if (formData.has("sector")) {
    data.sector = String(formData.get("sector") ?? "").trim() || null;
  }

  if (Object.keys(data).length > 0) {
    await db.patrol.update({ where: { id }, data });
  }
  revalidatePath("/dispatch");
}

// ---------------------------------------------------------------------------
// Affectations
// ---------------------------------------------------------------------------

/**
 * Déplace un agent vers une patrouille, ou vers le pool si `patrolId` est nul.
 *
 * Règle centrale du module : chacun déplace sa propre carte, le dispatch
 * déplace celles de tout le monde.
 */
export async function assignAgent(
  _state: DispatchState,
  formData: FormData,
): Promise<DispatchState> {
  try {
    const actor = await assertPermission(isSworn);

    const userId = Number(formData.get("userId"));
    const rawPatrol = String(formData.get("patrolId") ?? "");
    const patrolId = rawPatrol === "" || rawPatrol === "null" ? null : Number(rawPatrol);

    if (!userId) return fail("Agent introuvable.");

    if (!canMoveAgent(actor, userId)) {
      return fail(
        "Vous ne pouvez déplacer que votre propre carte. Seuls le Watch Commander, son adjoint et le commandement affectent les autres agents.",
      );
    }

    const target = await db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    if (!target) return fail("Agent introuvable.");

    if (patrolId === null) {
      await db.patrolMember.deleteMany({ where: { userId } });
    } else {
      const patrol = await db.patrol.findUnique({
        where: { id: patrolId },
        include: { members: true },
      });
      if (!patrol) return fail("Patrouille introuvable.");

      // Un agent n'appartient qu'à une patrouille : on retire l'ancienne
      // affectation avant de créer la nouvelle.
      await db.patrolMember.deleteMany({ where: { userId } });
      await db.patrolMember.create({
        data: {
          patrolId,
          userId,
          // Le premier arrivé prend le rôle de chef de bord.
          isLead: patrol.members.length === 0,
        },
      });
    }

    await audit({
      userId: actor.id,
      action: patrolId === null ? "PATROL_LEAVE" : "PATROL_JOIN",
      targetType: "User",
      targetId: userId,
      detail: `${target.firstName} ${target.lastName}`,
    });

    revalidatePath("/dispatch");
    return { success: "Affectation enregistrée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

/** Variante sans état, pour les boutons de glisser-déposer. */
export async function moveAgent(formData: FormData) {
  const result = await assignAgent(undefined, formData);
  if (result?.error) throw new Error(result.error);
}

export async function setPatrolLead(formData: FormData) {
  const actor = await assertPermission(can.manageDispatch);
  const userId = Number(formData.get("userId"));

  const membership = await db.patrolMember.findUnique({ where: { userId } });
  if (!membership) throw new Error("Cet agent n'est affecté à aucune patrouille.");

  await db.$transaction([
    db.patrolMember.updateMany({
      where: { patrolId: membership.patrolId },
      data: { isLead: false },
    }),
    db.patrolMember.update({ where: { userId }, data: { isLead: true } }),
  ]);

  await audit({
    userId: actor.id,
    action: "PATROL_LEAD",
    targetType: "User",
    targetId: userId,
  });

  revalidatePath("/dispatch");
}

// ---------------------------------------------------------------------------
// DEFCON
// ---------------------------------------------------------------------------

export async function setDefcon(
  _state: DispatchState,
  formData: FormData,
): Promise<DispatchState> {
  try {
    const actor = await assertPermission(
      (u: SessionUser) => u.isSuperAdmin || u.rank.level >= 85,
      "Le niveau DEFCON est fixé par le Command Staff, à partir du grade de Commander.",
    );

    const level = Number(formData.get("level"));
    if (![1, 2, 3, 4, 5].includes(level)) return fail("Niveau invalide.");

    const reason = String(formData.get("reason") ?? "").trim();

    // Un abaissement à 3 ou moins change les règles de port d'arme sur le
    // terrain : il doit être motivé pour que chacun comprenne pourquoi.
    if (level <= 3 && !reason) {
      return fail("Un niveau DEFCON 3 ou inférieur doit être motivé.");
    }

    await db.departmentStatus.upsert({
      where: { id: 1 },
      update: { defconLevel: level, defconReason: reason || null, updatedById: actor.id },
      create: {
        id: 1,
        defconLevel: level,
        defconReason: reason || null,
        updatedById: actor.id,
      },
    });

    await audit({
      userId: actor.id,
      action: "DEFCON_SET",
      detail: `DEFCON ${level}${reason ? ` — ${reason}` : ""}`,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dispatch");
    return { success: `DEFCON ${level} en vigueur.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}
