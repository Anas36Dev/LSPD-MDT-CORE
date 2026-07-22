"use server";

import { revalidatePath } from "next/cache";

import { audit, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PING_STALE_MS } from "@/lib/duty";

/** Prendre son service : ouvre une nouvelle vacation. */
export async function startDuty() {
  const user = await getCurrentUser();
  if (!user) return;

  const open = await db.dutyShift.findFirst({
    where: { userId: user.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (open) {
    const stale = Date.now() - open.lastPingAt.getTime() >= PING_STALE_MS;
    if (!stale) {
      revalidatePath("/dashboard"); // déjà en service
      return;
    }
    // Vacation restée ouverte (page fermée sans terminer) : on la clôt au
    // dernier ping avant d'en ouvrir une nouvelle.
    await db.dutyShift.update({
      where: { id: open.id },
      data: { endedAt: open.lastPingAt },
    });
  }

  await db.dutyShift.create({ data: { userId: user.id } });
  await audit({ userId: user.id, action: "DUTY_START", targetType: "User", targetId: user.id });

  revalidatePath("/dashboard");
}

/** Terminer son service : clôt la vacation en cours. */
export async function endDuty() {
  const user = await getCurrentUser();
  if (!user) return;

  await db.dutyShift.updateMany({
    where: { userId: user.id, endedAt: null },
    data: { endedAt: new Date() },
  });
  await audit({ userId: user.id, action: "DUTY_END", targetType: "User", targetId: user.id });

  revalidatePath("/dashboard");
}

/**
 * Battement de cœur : tant que la page reste ouverte et l'agent en service,
 * on rafraîchit `lastPingAt`. Aucun revalidate (appelé en boucle).
 */
export async function pingDuty() {
  const user = await getCurrentUser();
  if (!user) return;
  await db.dutyShift.updateMany({
    where: { userId: user.id, endedAt: null },
    data: { lastPingAt: new Date() },
  });
}
