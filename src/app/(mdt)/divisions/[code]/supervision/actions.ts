"use server";

import { revalidatePath } from "@/lib/revalidate";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { canSuperviseDivisionSpace } from "@/lib/permissions";

export type NoteState = { error?: string; success?: string } | undefined;

const fail = (error: string): NoteState => ({ error });

export async function addAgentNote(
  _state: NoteState,
  formData: FormData,
): Promise<NoteState> {
  try {
    const code = String(formData.get("code") ?? "").toUpperCase();
    const user = await assertPermission((u) =>
      canSuperviseDivisionSpace(u, code),
    );

    const subjectId = Number(formData.get("subjectId"));
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return fail("La note est vide.");

    // L'agent doit bien appartenir à cette division : on ne dépose pas de note
    // hors de son propre périmètre de supervision.
    const inDivision = await db.userDivision.findFirst({
      where: { userId: subjectId, division: { code } },
    });
    if (!inDivision) return fail("Cet agent n'appartient pas à la division.");

    await db.agentNote.create({
      data: { subjectId, authorId: user.id, divisionCode: code, body },
    });

    await audit({
      userId: user.id,
      action: "AGENT_NOTE_ADD",
      targetType: "User",
      targetId: subjectId,
      detail: `Note ${code}`,
    });

    revalidatePath(`/divisions/${code}/supervision`);
    return { success: "Note enregistrée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}
