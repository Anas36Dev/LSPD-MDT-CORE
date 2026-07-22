"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { can } from "@/lib/permissions";

export type AnnouncementState = { error?: string; success?: string } | undefined;

const fail = (error: string): AnnouncementState => ({ error });

export async function createAnnouncement(
  _state: AnnouncementState,
  formData: FormData,
): Promise<AnnouncementState> {
  try {
    const user = await assertPermission(can.publishAnnouncement);

    const title = String(formData.get("title") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();

    if (!title) return fail("Le titre est obligatoire.");
    if (!body) return fail("Le corps de l'annonce est obligatoire.");

    const announcement = await db.announcement.create({
      data: {
        title,
        body,
        priority: String(formData.get("priority") ?? "NORMAL"),
        divisionId: Number(formData.get("divisionId")) || null,
        visibleToAcademy: formData.get("visibleToAcademy") === "on",
        isPinned: formData.get("isPinned") === "on",
        authorId: user.id,
      },
    });

    await audit({
      userId: user.id,
      action: "ANNOUNCEMENT_CREATE",
      targetType: "Announcement",
      targetId: announcement.id,
      detail: title,
    });

    revalidatePath("/announcements");
    revalidatePath("/dashboard");
    return { success: "Annonce publiée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deleteAnnouncement(formData: FormData) {
  const user = await assertPermission(can.publishAnnouncement);
  const id = Number(formData.get("id"));

  const announcement = await db.announcement.findUnique({ where: { id } });
  if (!announcement) throw new Error("Annonce introuvable.");

  // Un agent ne retire que ses propres annonces ; le Command Staff peut
  // retirer n'importe laquelle.
  if (
    announcement.authorId !== user.id &&
    !user.isSuperAdmin &&
    user.rank.level < 85
  ) {
    throw new Error("Vous ne pouvez retirer que vos propres annonces.");
  }

  await db.announcement.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "ANNOUNCEMENT_DELETE",
    targetType: "Announcement",
    targetId: id,
    detail: announcement.title,
  });

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
}

export async function togglePin(formData: FormData) {
  const user = await assertPermission(can.publishAnnouncement);
  const id = Number(formData.get("id"));

  const announcement = await db.announcement.findUnique({ where: { id } });
  if (!announcement) throw new Error("Annonce introuvable.");

  await db.announcement.update({
    where: { id },
    data: { isPinned: !announcement.isPinned },
  });

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
}
