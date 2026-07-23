"use server";

import { revalidatePath } from "@/lib/revalidate";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { canSuperviseAcademy } from "@/lib/permissions";

export type ScheduleState = { error?: string; success?: string } | undefined;

const fail = (error: string): ScheduleState => ({ error });

/** "HH:MM" → minutes depuis minuit, ou null si invalide. */
function parseTime(v: FormDataEntryValue | null): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export async function createScheduleSlot(
  _state: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  try {
    const user = await assertPermission(canSuperviseAcademy);

    const dayOfWeek = Number(formData.get("dayOfWeek"));
    const title = String(formData.get("title") ?? "").trim();
    const startMin = parseTime(formData.get("start"));
    const endMin = parseTime(formData.get("end"));

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return fail("Jour invalide.");
    }
    if (!title) return fail("L'intitulé est obligatoire.");
    if (startMin === null || endMin === null) return fail("Horaires invalides.");
    if (startMin === endMin) return fail("Le début et la fin sont identiques.");

    await db.academyScheduleSlot.create({
      data: {
        dayOfWeek,
        startMin,
        endMin,
        title,
        location: String(formData.get("location") ?? "").trim() || null,
        details: String(formData.get("details") ?? "").trim() || null,
        createdById: user.id,
      },
    });

    await audit({
      userId: user.id,
      action: "ACADEMY_SLOT_CREATE",
      targetType: "AcademyScheduleSlot",
      detail: title,
    });

    revalidatePath("/academy");
    return { success: "Créneau ajouté au planning." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

/** Déplacer un créneau (glisser-déposer) : nouveau jour et nouveaux horaires. */
export async function moveScheduleSlot(
  id: number,
  dayOfWeek: number,
  startMin: number,
  endMin: number,
) {
  const user = await assertPermission(canSuperviseAcademy);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return;
  if (![startMin, endMin].every((n) => Number.isInteger(n) && n >= 0 && n < 1440)) {
    return;
  }

  await db.academyScheduleSlot.update({
    where: { id },
    data: { dayOfWeek, startMin, endMin },
  });
  await audit({
    userId: user.id,
    action: "ACADEMY_SLOT_MOVE",
    targetType: "AcademyScheduleSlot",
    targetId: id,
  });

  revalidatePath("/academy");
}

export async function deleteScheduleSlot(formData: FormData) {
  const user = await assertPermission(canSuperviseAcademy);
  const id = Number(formData.get("slotId"));

  const slot = await db.academyScheduleSlot.findUnique({ where: { id } });
  if (!slot) throw new Error("Créneau introuvable.");

  await db.academyScheduleSlot.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "ACADEMY_SLOT_DELETE",
    targetType: "AcademyScheduleSlot",
    detail: slot.title,
  });

  revalidatePath("/academy");
}
