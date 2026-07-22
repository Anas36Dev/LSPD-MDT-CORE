"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { can } from "@/lib/permissions";

export type DivisionState = { error?: string; success?: string } | undefined;

const fail = (error: string): DivisionState => ({ error });

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";

/**
 * Dérive un code stable et unique à partir d'un libellé. Les codes servent de
 * clés aux règles de permission : on les fige à la création et on ne les modifie
 * plus ensuite, pour ne pas casser les habilitations existantes.
 */
function slugify(name: string): string {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

async function uniqueCode(
  base: string,
  exists: (code: string) => Promise<boolean>,
): Promise<string> {
  const root = base || "DIV";
  if (!(await exists(root))) return root;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${root}_${n}`.slice(0, 44);
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("Impossible de générer un code unique.");
}

// ---------------------------------------------------------------------------
// Divisions
// ---------------------------------------------------------------------------

export async function createDivision(
  _state: DivisionState,
  formData: FormData,
): Promise<DivisionState> {
  try {
    const actor = await assertPermission(can.manageDivisions);
    const name = text(formData.get("name"));
    const shortName = text(formData.get("shortName")) || name;
    if (!name) return fail("Le nom de la division est obligatoire.");

    const minRankLevel = Number(formData.get("minRankLevel"));
    if (!Number.isInteger(minRankLevel)) {
      return fail("Grade minimum invalide.");
    }

    const code = await uniqueCode(slugify(name), async (c) =>
      Boolean(await db.division.findUnique({ where: { code: c } })),
    );

    const last = await db.division.findFirst({ orderBy: { order: "desc" } });

    const division = await db.division.create({
      data: {
        code,
        name,
        shortName,
        isRestricted: bool(formData.get("isRestricted")),
        minRankLevel,
        order: (last?.order ?? -1) + 1,
      },
    });

    await audit({
      userId: actor.id,
      action: "DIVISION_CREATE",
      targetType: "Division",
      targetId: division.id,
      detail: name,
    });

    revalidatePath("/divisions");
    return { success: `Division « ${name} » créée.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function updateDivision(
  _state: DivisionState,
  formData: FormData,
): Promise<DivisionState> {
  try {
    const actor = await assertPermission(can.manageDivisions);
    const id = Number(formData.get("id"));
    const name = text(formData.get("name"));
    const shortName = text(formData.get("shortName")) || name;
    if (!name) return fail("Le nom de la division est obligatoire.");

    const minRankLevel = Number(formData.get("minRankLevel"));
    if (!Number.isInteger(minRankLevel)) {
      return fail("Grade minimum invalide.");
    }

    await db.division.update({
      where: { id },
      data: {
        name,
        shortName,
        isRestricted: bool(formData.get("isRestricted")),
        minRankLevel,
      },
    });

    await audit({
      userId: actor.id,
      action: "DIVISION_UPDATE",
      targetType: "Division",
      targetId: id,
      detail: name,
    });

    revalidatePath("/divisions");
    return { success: "Division enregistrée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deleteDivision(formData: FormData) {
  const actor = await assertPermission(can.manageDivisions);
  const id = Number(formData.get("id"));

  const division = await db.division.findUnique({
    where: { id },
    include: { _count: { select: { members: true } } },
  });
  if (!division) throw new Error("Division introuvable.");

  // La suppression détache aussi les agents affectés (cascade sur UserDivision),
  // ainsi que les sous-unités et rôles internes.
  await db.division.delete({ where: { id } });

  await audit({
    userId: actor.id,
    action: "DIVISION_DELETE",
    targetType: "Division",
    targetId: id,
    detail: `${division.name} (${division._count.members} agent(s) détaché(s))`,
  });

  revalidatePath("/divisions");
  redirect("/divisions");
}

export async function reorderDivision(formData: FormData) {
  await assertPermission(can.manageDivisions);
  const id = Number(formData.get("id"));
  const direction = text(formData.get("direction")); // "up" | "down"

  const all = await db.division.findMany({ orderBy: { order: "asc" } });
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error("Division introuvable.");

  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= all.length) return; // déjà à l'extrémité

  const a = all[idx];
  const b = all[swapWith];
  await db.$transaction([
    db.division.update({ where: { id: a.id }, data: { order: b.order } }),
    db.division.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);

  revalidatePath("/divisions");
}

// ---------------------------------------------------------------------------
// Sous-unités
// ---------------------------------------------------------------------------

export async function createSubDivision(
  _state: DivisionState,
  formData: FormData,
): Promise<DivisionState> {
  try {
    const actor = await assertPermission(can.manageDivisions);
    const divisionId = Number(formData.get("divisionId"));
    const name = text(formData.get("name"));
    if (!name) return fail("Le nom de la sous-unité est obligatoire.");

    const division = await db.division.findUnique({ where: { id: divisionId } });
    if (!division) return fail("Division introuvable.");

    const last = await db.subDivision.findFirst({
      where: { divisionId },
      orderBy: { order: "desc" },
    });
    const code = await uniqueCode(
      `${division.code}_${slugify(name)}`,
      async (c) => Boolean(await db.subDivision.findUnique({ where: { code: c } })),
    );

    await db.subDivision.create({
      data: { divisionId, code, name, order: (last?.order ?? -1) + 1 },
    });

    await audit({
      userId: actor.id,
      action: "SUBDIVISION_CREATE",
      targetType: "Division",
      targetId: divisionId,
      detail: name,
    });

    revalidatePath("/divisions");
    return { success: `Sous-unité « ${name} » créée.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deleteSubDivision(formData: FormData) {
  const actor = await assertPermission(can.manageDivisions);
  const id = Number(formData.get("subDivisionId"));

  const sub = await db.subDivision.findUnique({ where: { id } });
  if (!sub) throw new Error("Sous-unité introuvable.");

  await db.subDivision.delete({ where: { id } });

  await audit({
    userId: actor.id,
    action: "SUBDIVISION_DELETE",
    targetType: "Division",
    targetId: sub.divisionId,
    detail: sub.name,
  });

  revalidatePath("/divisions");
}

// ---------------------------------------------------------------------------
// Rôles internes
// ---------------------------------------------------------------------------

export async function createDivisionRole(
  _state: DivisionState,
  formData: FormData,
): Promise<DivisionState> {
  try {
    const actor = await assertPermission(can.manageDivisions);
    const divisionId = Number(formData.get("divisionId"));
    const name = text(formData.get("name"));
    if (!name) return fail("Le nom du rôle est obligatoire.");

    const division = await db.division.findUnique({ where: { id: divisionId } });
    if (!division) return fail("Division introuvable.");

    const subDivisionId = Number(formData.get("subDivisionId")) || null;
    if (subDivisionId) {
      const sub = await db.subDivision.findUnique({ where: { id: subDivisionId } });
      if (!sub || sub.divisionId !== divisionId) {
        return fail("La sous-unité choisie n'appartient pas à cette division.");
      }
    }

    const last = await db.divisionRole.findFirst({
      where: { divisionId },
      orderBy: { order: "desc" },
    });
    const code = await uniqueCode(
      `${division.code}_${slugify(name)}`,
      async (c) =>
        Boolean(await db.divisionRole.findUnique({ where: { code: c } })),
    );

    await db.divisionRole.create({
      data: {
        divisionId,
        subDivisionId,
        code,
        name,
        isDivisionChief: bool(formData.get("isDivisionChief")),
        isUnitLead: bool(formData.get("isUnitLead")),
        canTrain: bool(formData.get("canTrain")),
        order: (last?.order ?? -1) + 1,
      },
    });

    await audit({
      userId: actor.id,
      action: "DIVISION_ROLE_CREATE",
      targetType: "Division",
      targetId: divisionId,
      detail: name,
    });

    revalidatePath("/divisions");
    return { success: `Rôle « ${name} » créé.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deleteDivisionRole(formData: FormData) {
  const actor = await assertPermission(can.manageDivisions);
  const id = Number(formData.get("roleId"));

  const role = await db.divisionRole.findUnique({ where: { id } });
  if (!role) throw new Error("Rôle introuvable.");

  await db.divisionRole.delete({ where: { id } });

  await audit({
    userId: actor.id,
    action: "DIVISION_ROLE_DELETE",
    targetType: "Division",
    targetId: role.divisionId,
    detail: role.name,
  });

  revalidatePath("/divisions");
}
