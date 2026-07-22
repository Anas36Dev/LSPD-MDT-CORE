"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { canAccessInvestigations } from "@/lib/permissions";

export type FactionState = { error?: string; success?: string } | undefined;

const fail = (error: string): FactionState => ({ error });

export async function createFaction(
  _state: FactionState,
  formData: FormData,
): Promise<FactionState> {
  let newId: number;
  try {
    const user = await assertPermission(canAccessInvestigations);
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (!name) return fail("Le nom du groupuscule est obligatoire.");
    if (!description) return fail("Une description est obligatoire.");

    const faction = await db.faction.create({
      data: { name, description, createdById: user.id },
    });
    newId = faction.id;

    await audit({
      userId: user.id,
      action: "FACTION_CREATE",
      targetType: "Faction",
      targetId: faction.id,
      detail: name,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }

  revalidatePath("/factions");
  redirect(`/factions/${newId}`);
}

export async function updateFactionStatus(formData: FormData) {
  const user = await assertPermission(canAccessInvestigations);
  const factionId = Number(formData.get("factionId"));
  const status = String(formData.get("status") ?? "");

  await db.faction.update({ where: { id: factionId }, data: { status } });
  await audit({
    userId: user.id,
    action: "FACTION_STATUS",
    targetType: "Faction",
    targetId: factionId,
    detail: status,
  });

  revalidatePath(`/factions/${factionId}`);
  revalidatePath("/factions");
}

export async function deleteFaction(formData: FormData) {
  const user = await assertPermission(canAccessInvestigations);
  const factionId = Number(formData.get("factionId"));

  const faction = await db.faction.findUnique({ where: { id: factionId } });
  if (!faction) throw new Error("Groupuscule introuvable.");

  await db.faction.delete({ where: { id: factionId } });
  await audit({
    userId: user.id,
    action: "FACTION_DELETE",
    targetType: "Faction",
    targetId: factionId,
    detail: faction.name,
  });

  revalidatePath("/factions");
  redirect("/factions");
}

export async function addFactionNote(
  _state: FactionState,
  formData: FormData,
): Promise<FactionState> {
  try {
    const user = await assertPermission(canAccessInvestigations);
    const factionId = Number(formData.get("factionId"));
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return fail("La note est vide.");

    await db.factionNote.create({
      data: { factionId, authorId: user.id, body },
    });
    await audit({
      userId: user.id,
      action: "FACTION_NOTE",
      targetType: "Faction",
      targetId: factionId,
    });

    revalidatePath(`/factions/${factionId}`);
    return { success: "Note ajoutée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

// --- Rattachements ---------------------------------------------------------

export async function linkReport(
  _state: FactionState,
  formData: FormData,
): Promise<FactionState> {
  try {
    const user = await assertPermission(canAccessInvestigations);
    const factionId = Number(formData.get("factionId"));
    const reportId = Number(formData.get("reportId"));
    if (!reportId) return fail("Sélectionnez un rapport.");

    const existing = await db.factionReport.findUnique({
      where: { factionId_reportId: { factionId, reportId } },
    });
    if (existing) return fail("Ce rapport est déjà rattaché.");

    await db.factionReport.create({ data: { factionId, reportId } });
    await audit({
      userId: user.id,
      action: "FACTION_LINK_REPORT",
      targetType: "Faction",
      targetId: factionId,
    });

    revalidatePath(`/factions/${factionId}`);
    return { success: "Rapport rattaché." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function unlinkReport(formData: FormData) {
  await assertPermission(canAccessInvestigations);
  const factionId = Number(formData.get("factionId"));
  const reportId = Number(formData.get("reportId"));
  await db.factionReport.delete({
    where: { factionId_reportId: { factionId, reportId } },
  });
  revalidatePath(`/factions/${factionId}`);
}

export async function linkInvestigation(
  _state: FactionState,
  formData: FormData,
): Promise<FactionState> {
  try {
    const user = await assertPermission(canAccessInvestigations);
    const factionId = Number(formData.get("factionId"));
    const investigationId = Number(formData.get("investigationId"));
    if (!investigationId) return fail("Sélectionnez une enquête.");

    const existing = await db.factionInvestigation.findUnique({
      where: { factionId_investigationId: { factionId, investigationId } },
    });
    if (existing) return fail("Cette enquête est déjà rattachée.");

    await db.factionInvestigation.create({
      data: { factionId, investigationId },
    });
    await audit({
      userId: user.id,
      action: "FACTION_LINK_INVESTIGATION",
      targetType: "Faction",
      targetId: factionId,
    });

    revalidatePath(`/factions/${factionId}`);
    return { success: "Enquête rattachée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function unlinkInvestigation(formData: FormData) {
  await assertPermission(canAccessInvestigations);
  const factionId = Number(formData.get("factionId"));
  const investigationId = Number(formData.get("investigationId"));
  await db.factionInvestigation.delete({
    where: { factionId_investigationId: { factionId, investigationId } },
  });
  revalidatePath(`/factions/${factionId}`);
}

export async function linkCivilian(
  _state: FactionState,
  formData: FormData,
): Promise<FactionState> {
  try {
    const user = await assertPermission(canAccessInvestigations);
    const factionId = Number(formData.get("factionId"));
    const civilianId = Number(formData.get("civilianId"));
    if (!civilianId) return fail("Sélectionnez un civil.");

    const existing = await db.factionCivilian.findUnique({
      where: { factionId_civilianId: { factionId, civilianId } },
    });
    if (existing) return fail("Ce civil est déjà rattaché.");

    await db.factionCivilian.create({
      data: {
        factionId,
        civilianId,
        role: String(formData.get("role") ?? "").trim() || null,
      },
    });
    await audit({
      userId: user.id,
      action: "FACTION_LINK_CIVILIAN",
      targetType: "Faction",
      targetId: factionId,
    });

    revalidatePath(`/factions/${factionId}`);
    return { success: "Civil rattaché." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function unlinkCivilian(formData: FormData) {
  await assertPermission(canAccessInvestigations);
  const factionId = Number(formData.get("factionId"));
  const civilianId = Number(formData.get("civilianId"));
  await db.factionCivilian.delete({
    where: { factionId_civilianId: { factionId, civilianId } },
  });
  revalidatePath(`/factions/${factionId}`);
}
