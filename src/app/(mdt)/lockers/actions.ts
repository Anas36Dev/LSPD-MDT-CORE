"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "@/lib/revalidate";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { notifyMany } from "@/lib/notify";
import {
  isCommandStaff,
  isDepartmentHead,
  isSupervisor,
  isSworn,
} from "@/lib/permissions";
import { unlockCookie } from "./constants";

export type LockerState = { error?: string; success?: string } | undefined;

const fail = (error: string): LockerState => ({ error });

// ---------------------------------------------------------------------------
// Verrouillage par code
// ---------------------------------------------------------------------------

export async function unlockLocker(
  _state: LockerState,
  formData: FormData,
): Promise<LockerState> {
  try {
    await assertPermission(isSworn);
    const lockerId = Number(formData.get("lockerId"));
    const code = String(formData.get("code") ?? "").trim();

    const locker = await db.locker.findUnique({ where: { id: lockerId } });
    if (!locker) return fail("Casier introuvable.");
    if (locker.accessCode && locker.accessCode !== code) {
      return fail("Code incorrect.");
    }

    (await cookies()).set(unlockCookie(lockerId), "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    revalidatePath("/lockers");
    return { success: "Casier déverrouillé." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function lockLocker(formData: FormData) {
  const lockerId = Number(formData.get("lockerId"));
  (await cookies()).delete(unlockCookie(lockerId));
  revalidatePath("/lockers");
}

// ---------------------------------------------------------------------------
// Objets
// ---------------------------------------------------------------------------

export async function depositItem(
  _state: LockerState,
  formData: FormData,
): Promise<LockerState> {
  try {
    const user = await assertPermission(isSworn);
    const lockerId = Number(formData.get("lockerId"));
    const label = String(formData.get("label") ?? "").trim();
    const rawQty = String(formData.get("quantity") ?? "").trim();
    const quantity = rawQty ? Number(rawQty) : null;

    if (!label) return fail("Décrivez l'objet déposé.");
    const locker = await db.locker.findUnique({ where: { id: lockerId } });
    if (!locker) return fail("Casier introuvable.");

    await db.lockerItem.create({
      data: {
        lockerId,
        label,
        quantity: quantity && quantity > 0 ? quantity : null,
        depositedById: user.id,
      },
    });

    await audit({
      userId: user.id,
      action: "LOCKER_DEPOSIT",
      targetType: "Locker",
      targetId: lockerId,
      detail: `${locker.name} — ${label}`,
    });

    revalidatePath("/lockers");
    return { success: "Dépôt enregistré." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

/** Retrait d'un objet : réservé à partir de Sergeant I. */
export async function removeItem(formData: FormData) {
  const user = await assertPermission(
    isSupervisor,
    "Le retrait d'objets est réservé à partir de Sergeant I.",
  );
  const id = Number(formData.get("itemId"));

  const item = await db.lockerItem.findUnique({ where: { id } });
  if (!item) return;

  await db.lockerItem.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "LOCKER_WITHDRAW",
    targetType: "Locker",
    targetId: item.lockerId,
    detail: item.label,
  });

  revalidatePath("/lockers");
}

/** Vider entièrement un casier — réservé au Chief of Police. */
export async function emptyLocker(formData: FormData) {
  const user = await assertPermission(
    isDepartmentHead,
    "Seul le Chief of Police peut vider un casier.",
  );
  const id = Number(formData.get("id"));

  const locker = await db.locker.findUnique({ where: { id } });
  if (!locker) throw new Error("Casier introuvable.");

  const { count } = await db.lockerItem.deleteMany({ where: { lockerId: id } });
  await audit({
    userId: user.id,
    action: "LOCKER_EMPTY",
    targetType: "Locker",
    targetId: id,
    detail: `${locker.name} — ${count} objet(s) retiré(s)`,
  });

  // Tout le Chief Office est prévenu que le casier a été vidé.
  const chiefOffice = await db.user.findMany({
    where: { status: "ACTIVE", rank: { category: "CHIEF_OFFICE" } },
    select: { id: true },
  });
  await notifyMany(
    chiefOffice.map((u) => u.id),
    {
      type: "LOCKER_EMPTY",
      title: `Casier vidé — ${locker.name}`,
      body: `${user.rank.name} ${user.firstName} ${user.lastName} a signalé que le casier « ${locker.name} » a été vidé (${count} objet(s) retiré(s)).`,
      link: "/lockers",
    },
  );

  revalidatePath("/lockers");
}

// ---------------------------------------------------------------------------
// Casiers (Command Staff)
// ---------------------------------------------------------------------------

export async function createLocker(
  _state: LockerState,
  formData: FormData,
): Promise<LockerState> {
  try {
    const user = await assertPermission(
      isCommandStaff,
      "Réservé au Command Staff.",
    );
    const name = String(formData.get("name") ?? "").trim();
    const accessCode = String(formData.get("accessCode") ?? "").trim();
    if (!name) return fail("Le nom du casier est obligatoire.");

    const last = await db.locker.findFirst({ orderBy: { order: "desc" } });

    const locker = await db.locker.create({
      data: {
        name,
        accessCode: accessCode || null,
        order: (last?.order ?? 0) + 1,
        createdById: user.id,
      },
    });

    await audit({
      userId: user.id,
      action: "LOCKER_CREATE",
      targetType: "Locker",
      targetId: locker.id,
      detail: name,
    });

    revalidatePath("/lockers");
    return { success: `Casier « ${name} » créé.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

/** Réordonner les casiers par glisser-déposer — réservé au Chief Office. */
export async function reorderLockers(ids: number[]) {
  const user = await assertPermission(
    (u) => u.isSuperAdmin || u.rank.category === "CHIEF_OFFICE",
    "Le réarrangement des casiers est réservé au Chief Office.",
  );

  await db.$transaction(
    ids.map((id, index) =>
      db.locker.update({ where: { id }, data: { order: index } }),
    ),
  );

  await audit({
    userId: user.id,
    action: "LOCKER_REORDER",
    targetType: "Locker",
  });

  revalidatePath("/lockers");
}

export async function deleteLocker(formData: FormData) {
  const user = await assertPermission(
    isCommandStaff,
    "Réservé au Command Staff.",
  );
  const id = Number(formData.get("id"));

  const locker = await db.locker.findUnique({ where: { id } });
  if (!locker) throw new Error("Casier introuvable.");
  if (locker.isDefault) {
    throw new Error("Les casiers par défaut ne peuvent pas être supprimés.");
  }

  await db.locker.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "LOCKER_DELETE",
    targetType: "Locker",
    targetId: id,
    detail: locker.name,
  });

  revalidatePath("/lockers");
}
