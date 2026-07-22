"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { audit, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { notify } from "@/lib/notify";
import { isSworn } from "@/lib/permissions";

export type MessageState = { error?: string; success?: string } | undefined;

const fail = (error: string): MessageState => ({ error });

export async function sendMessage(
  _state: MessageState,
  formData: FormData,
): Promise<MessageState> {
  try {
    const user = await assertPermission(isSworn);

    const recipientId = Number(formData.get("recipientId"));
    const subject = String(formData.get("subject") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();

    if (!recipientId) return fail("Sélectionnez un destinataire.");
    if (!subject) return fail("L'objet est obligatoire.");
    if (!body) return fail("Le message est vide.");
    if (recipientId === user.id) {
      return fail("Vous ne pouvez pas vous écrire à vous-même.");
    }

    const recipient = await db.user.findUnique({ where: { id: recipientId } });
    if (!recipient) return fail("Destinataire introuvable.");
    if (recipient.status === "SUSPENDED" || recipient.status === "DISCHARGED") {
      return fail("Ce compte n'est plus actif.");
    }

    await db.message.create({
      data: { senderId: user.id, recipientId, subject, body },
    });

    await audit({
      userId: user.id,
      action: "MESSAGE_SEND",
      targetType: "User",
      targetId: recipientId,
      detail: subject,
    });

    await notify(recipientId, {
      type: "MESSAGE",
      title: `Nouveau message — ${user.firstName} ${user.lastName}`,
      body: subject,
      link: "/messages",
    });

    revalidatePath("/messages");
    return { success: `Message envoyé à ${recipient.firstName} ${recipient.lastName}.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function markRead(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Session expirée.");

  const id = Number(formData.get("id"));

  // On ne marque comme lu que ses propres messages : `updateMany` avec le
  // destinataire dans la clause évite qu'un identifiant deviné suffise.
  await db.message.updateMany({
    where: { id, recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/messages");
}

export async function deleteMessage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Session expirée.");

  const id = Number(formData.get("id"));

  await db.message.deleteMany({
    where: { id, OR: [{ recipientId: user.id }, { senderId: user.id }] },
  });

  revalidatePath("/messages");
  redirect("/messages");
}
