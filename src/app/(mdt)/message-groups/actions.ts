"use server";

import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";

import { audit, getCurrentUser } from "@/lib/auth";
import { saveDataUrl } from "@/lib/chat-upload";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { canAccessChannel, channelByKey } from "@/lib/message-channels";
import { isCommandStaff, isPreviewing } from "@/lib/permissions";

export type ChatState = { error?: string } | undefined;

const fail = (error: string): ChatState => ({ error });

export async function sendGroupMessage(
  _state: ChatState,
  formData: FormData,
): Promise<ChatState> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Session expirée.");
    if (isPreviewing(user)) return fail("Mode aperçu : envoi impossible.");

    const channelKey = String(formData.get("channel") ?? "");
    const channel = await channelByKey(channelKey);
    if (!channel) return fail("Canal introuvable.");
    if (!canAccessChannel(user, channel)) {
      return fail("Vous n'avez pas accès à ce canal.");
    }

    const body = String(formData.get("body") ?? "").trim();
    const pasted = String(formData.get("image") ?? "");

    let imageUrl: string | null = null;
    if (pasted.startsWith("data:")) {
      imageUrl = await saveDataUrl(pasted);
    }

    if (!body && !imageUrl) {
      return fail("Message vide.");
    }

    await db.groupMessage.create({
      data: {
        channel: channel.key,
        senderId: user.id,
        body: body || null,
        imageUrl,
      },
    });

    revalidatePath(`/message-groups/${channel.key}`);
    return undefined;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deleteGroupMessage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Session expirée.");
  const id = Number(formData.get("id"));

  const message = await db.groupMessage.findUnique({ where: { id } });
  if (!message) return;

  // Chacun supprime ses propres messages ; le Command Staff modère.
  if (message.senderId !== user.id && !isCommandStaff(user)) {
    throw new Error("Vous ne pouvez supprimer que vos propres messages.");
  }

  await db.groupMessage.delete({ where: { id } });
  revalidatePath(`/message-groups/${message.channel}`);
}

// ---------------------------------------------------------------------------
// Canaux personnalisés (Command Staff)
// ---------------------------------------------------------------------------

export type ChannelState = { error?: string; success?: string } | undefined;

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "canal";

export async function createChannel(
  _state: ChannelState,
  formData: FormData,
): Promise<ChannelState> {
  let key: string;
  try {
    const user = await assertPermission(
      isCommandStaff,
      "Réservé au Command Staff.",
    );

    const name = String(formData.get("name") ?? "").trim();
    const rankCodes = formData.getAll("rankCode").map(String).filter(Boolean);
    const userIds = formData
      .getAll("userId")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0);
    const divisionCodes = formData
      .getAll("divisionCode")
      .map(String)
      .filter(Boolean);
    const certCodes = formData.getAll("certCode").map(String).filter(Boolean);

    if (!name) return { error: "Le nom du canal est obligatoire." };
    if (
      rankCodes.length === 0 &&
      userIds.length === 0 &&
      divisionCodes.length === 0 &&
      certCodes.length === 0
    ) {
      return {
        error: "Sélectionnez au moins un grade, une division, une habilitation ou un membre.",
      };
    }

    // Clé unique (slug + suffixe si collision).
    const base = `c-${slugify(name)}`;
    key = base;
    for (let i = 2; await db.messageChannel.findUnique({ where: { key } }); i++) {
      key = `${base}-${i}`;
    }

    const channel = await db.messageChannel.create({
      data: { key, name, rankCodes, userIds, createdById: user.id },
    });

    await audit({
      userId: user.id,
      action: "CHANNEL_CREATE",
      targetType: "MessageChannel",
      targetId: channel.id,
      detail: name,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }

  revalidatePath("/message-groups");
  redirect(`/message-groups/${key}`);
}

function readAccess(formData: FormData) {
  return {
    rankCodes: formData.getAll("rankCode").map(String).filter(Boolean),
    userIds: formData
      .getAll("userId")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0),
    divisionCodes: formData.getAll("divisionCode").map(String).filter(Boolean),
    certCodes: formData.getAll("certCode").map(String).filter(Boolean),
  };
}

export async function updateChannel(
  _state: ChannelState,
  formData: FormData,
): Promise<ChannelState> {
  let key: string;
  try {
    const user = await assertPermission(
      isCommandStaff,
      "Réservé au Command Staff.",
    );
    const id = Number(formData.get("channelId"));
    const channel = await db.messageChannel.findUnique({ where: { id } });
    if (!channel) return { error: "Canal introuvable." };
    key = channel.key;

    const name = String(formData.get("name") ?? "").trim() || channel.name;
    const access = readAccess(formData);
    if (
      access.rankCodes.length === 0 &&
      access.userIds.length === 0 &&
      access.divisionCodes.length === 0 &&
      access.certCodes.length === 0
    ) {
      return {
        error: "Sélectionnez au moins un grade, une division, une habilitation ou un membre.",
      };
    }

    await db.messageChannel.update({
      where: { id },
      data: { name, ...access },
    });

    await audit({
      userId: user.id,
      action: "CHANNEL_UPDATE",
      targetType: "MessageChannel",
      targetId: id,
      detail: name,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }

  revalidatePath("/message-groups");
  redirect(`/message-groups/${key}`);
}

export async function deleteChannel(formData: FormData) {
  const user = await assertPermission(
    isCommandStaff,
    "Réservé au Command Staff.",
  );
  const id = Number(formData.get("id"));

  const channel = await db.messageChannel.findUnique({ where: { id } });
  if (!channel) throw new Error("Canal introuvable.");

  // Les messages du canal partent avec lui.
  await db.groupMessage.deleteMany({ where: { channel: channel.key } });
  await db.messageChannel.delete({ where: { id } });

  await audit({
    userId: user.id,
    action: "CHANNEL_DELETE",
    targetType: "MessageChannel",
    targetId: id,
    detail: channel.name,
  });

  revalidatePath("/message-groups");
  redirect("/message-groups");
}
