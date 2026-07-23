"use server";

import { revalidatePath } from "@/lib/revalidate";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canReviewFeedback, isPreviewing } from "@/lib/permissions";

export type FeedbackState = { error?: string; success?: string } | undefined;

const fail = (error: string): FeedbackState => ({ error });

const TYPES = ["SUGGESTION", "BUG", "OTHER"] as const;

export async function submitFeedback(
  _state: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Session expirée. Reconnectez-vous.");
    if (isPreviewing(user)) {
      return fail("Mode aperçu : envoi impossible.");
    }

    const rawType = String(formData.get("type") ?? "SUGGESTION");
    const type = (TYPES as readonly string[]).includes(rawType)
      ? rawType
      : "SUGGESTION";
    const message = String(formData.get("message") ?? "").trim();

    if (message.length < 5) {
      return fail("Décrivez votre retour (5 caractères minimum).");
    }

    await db.feedback.create({
      data: { userId: user.id, type, message },
    });

    revalidatePath("/feedback");
    return { success: "Merci ! Votre retour a bien été transmis." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

async function requireFeedbackReviewer() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Session expirée.");
  if (!canReviewFeedback(user)) {
    throw new Error("Réservé au Chief of Police et à l'Assistant Chief.");
  }
  return user;
}

export async function toggleFeedbackReviewed(formData: FormData) {
  await requireFeedbackReviewer();
  const id = Number(formData.get("id"));
  const fb = await db.feedback.findUnique({ where: { id } });
  if (!fb) throw new Error("Retour introuvable.");

  await db.feedback.update({
    where: { id },
    data: { status: fb.status === "NEW" ? "REVIEWED" : "NEW" },
  });
  revalidatePath("/feedback");
}

export async function deleteFeedback(formData: FormData) {
  await requireFeedbackReviewer();
  const id = Number(formData.get("id"));
  await db.feedback.delete({ where: { id } });
  revalidatePath("/feedback");
}
