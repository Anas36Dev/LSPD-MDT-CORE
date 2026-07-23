"use server";

import { revalidatePath } from "@/lib/revalidate";

import { audit, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { canConvene } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { formatDateTime } from "@/lib/utils";

export type ConvocationState = { error?: string; success?: string } | undefined;

const fail = (error: string): ConvocationState => ({ error });

export async function createConvocation(
  _state: ConvocationState,
  formData: FormData,
): Promise<ConvocationState> {
  try {
    const user = await assertPermission(canConvene);

    const agentId = Number(formData.get("agentId"));
    const location = String(formData.get("location") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const rawWhen = String(formData.get("scheduledAt") ?? "").trim();
    const scheduledAt = rawWhen ? new Date(rawWhen) : null;

    if (!agentId) return fail("Sélectionnez l'agent à convoquer.");
    if (!location) return fail("Précisez le lieu de la convocation.");
    if (!reason) return fail("Le motif de la convocation est obligatoire.");
    if (agentId === user.id) {
      return fail("Vous ne pouvez pas vous convoquer vous-même.");
    }

    const agent = await db.user.findUnique({ where: { id: agentId } });
    if (!agent) return fail("Agent introuvable.");

    const convocation = await db.convocation.create({
      data: {
        agentId,
        summonedById: user.id,
        location,
        reason,
        scheduledAt,
      },
    });

    await audit({
      userId: user.id,
      action: "CONVOCATION_CREATE",
      targetType: "Convocation",
      targetId: convocation.id,
      detail: `${agent.firstName} ${agent.lastName} — ${location}`,
    });

    // L'agent est prévenu par notification, avec le détail de la convocation.
    const whenLabel = scheduledAt ? ` le ${formatDateTime(scheduledAt)}` : "";
    await notify(agentId, {
      type: "CONVOCATION",
      title: `Convocation — ${location}`,
      body: `${user.rank.name} ${user.firstName} ${user.lastName} vous convoque à ${location}${whenLabel}. Motif : ${reason}`,
      link: "/dashboard",
    });

    revalidatePath("/convocations");
    return {
      success: `Convocation envoyée à ${agent.firstName} ${agent.lastName}.`,
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function cancelConvocation(formData: FormData) {
  const user = await assertPermission(canConvene);
  const id = Number(formData.get("id"));

  await db.convocation.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await audit({
    userId: user.id,
    action: "CONVOCATION_CANCEL",
    targetType: "Convocation",
    targetId: id,
  });

  revalidatePath("/convocations");
  revalidatePath("/dashboard");
}

/**
 * Supprime définitivement une convocation, quel que soit son statut. Réservé au
 * Command Staff / superviseurs (même habilitation que pour convoquer). À la
 * différence de l'annulation, la convocation disparaît complètement de la liste.
 */
export async function deleteConvocation(formData: FormData) {
  const user = await assertPermission(canConvene);
  const id = Number(formData.get("id"));

  const convocation = await db.convocation.findUnique({ where: { id } });
  if (!convocation) return;

  await db.convocation.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "CONVOCATION_DELETE",
    targetType: "Convocation",
    targetId: id,
  });

  revalidatePath("/convocations");
  revalidatePath("/dashboard");
}

/** L'agent convoqué accuse réception : la convocation quitte ses épingles. */
export async function acknowledgeConvocation(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Session expirée.");
  const id = Number(formData.get("id"));

  // La clause sur l'agent empêche d'acquitter la convocation d'autrui.
  await db.convocation.updateMany({
    where: { id, agentId: user.id, status: "PENDING" },
    data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() },
  });

  revalidatePath("/dashboard");
  revalidatePath("/convocations");
}
