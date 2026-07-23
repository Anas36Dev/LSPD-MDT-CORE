"use server";

import { revalidatePath } from "@/lib/revalidate";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Session expirée.");

  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/notifications");
}

export async function deleteNotification(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Session expirée.");

  const id = Number(formData.get("id"));
  // La clause sur le destinataire empêche de supprimer la notification d'autrui.
  await db.notification.deleteMany({ where: { id, userId: user.id } });

  revalidatePath("/notifications");
}

export async function clearNotifications() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Session expirée.");

  await db.notification.deleteMany({ where: { userId: user.id } });

  revalidatePath("/notifications");
}
