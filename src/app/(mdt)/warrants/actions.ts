"use server";

import { revalidatePath } from "@/lib/revalidate";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { officerSignature } from "@/lib/utils";

export type WarrantState = { error?: string; success?: string } | undefined;

const fail = (error: string): WarrantState => ({ error });

/**
 * Référence séquentielle par préfixe et par année. Le préfixe dépend du type
 * de document : ARREST-2026-0042, PERQUISITION-2026-0042, RECHERCHE-2026-0042.
 */
async function nextReference(table: "warrant" | "bolo", prefix: string) {
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}-`;

  const last =
    table === "warrant"
      ? await db.warrant.findFirst({
          where: { reference: { startsWith: base } },
          orderBy: { reference: "desc" },
          select: { reference: true },
        })
      : await db.bolo.findFirst({
          where: { reference: { startsWith: base } },
          orderBy: { reference: "desc" },
          select: { reference: true },
        });

  const seq = last ? Number(last.reference.slice(base.length)) + 1 : 1;
  return `${base}${String(seq).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Mandats
// ---------------------------------------------------------------------------

export async function createWarrant(
  _state: WarrantState,
  formData: FormData,
): Promise<WarrantState> {
  try {
    const user = await assertPermission(can.issueWarrant);

    const subjectName = String(formData.get("subjectName") ?? "").trim();
    const type = String(formData.get("type") ?? "ARREST");
    const reason = String(formData.get("reason") ?? "").trim();

    if (!subjectName) return fail("Saisissez le prénom et le nom de l'individu visé.");
    if (!reason) return fail("Le motif du mandat est obligatoire.");
    if (formData.get("signed") !== "true") {
      return fail("Vous devez signer le mandat avant de l'émettre.");
    }

    // Mandat d'arrêt (ARREST) ou de perquisition (SEARCH → PERQUISITION).
    const prefix = type === "SEARCH" ? "PERQUISITION" : "ARREST";

    const warrant = await db.warrant.create({
      data: {
        reference: await nextReference("warrant", prefix),
        subjectName,
        issuedById: user.id,
        type,
        reason,
        signature: officerSignature(user),
      },
    });

    await audit({
      userId: user.id,
      action: "WARRANT_ISSUE",
      targetType: "Warrant",
      targetId: warrant.id,
      detail: `${warrant.reference} — ${subjectName} — ${reason}`,
    });

    revalidatePath("/warrants");
    return { success: `Mandat ${warrant.reference} émis.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function updateWarrantStatus(formData: FormData) {
  const user = await assertPermission(can.issueWarrant);
  const id = Number(formData.get("warrantId"));
  const status = String(formData.get("status"));

  if (!["ACTIVE", "EXECUTED", "CANCELLED", "EXPIRED"].includes(status)) {
    throw new Error("Statut invalide.");
  }

  const warrant = await db.warrant.update({
    where: { id },
    data: { status },
  });

  await audit({
    userId: user.id,
    action: "WARRANT_STATUS",
    targetType: "Warrant",
    targetId: id,
    detail: `${warrant.reference} → ${status}`,
  });

  revalidatePath("/warrants");
}

// ---------------------------------------------------------------------------
// BOLO
// ---------------------------------------------------------------------------

export async function createBolo(
  _state: WarrantState,
  formData: FormData,
): Promise<WarrantState> {
  try {
    const user = await assertPermission(can.issueWarrant);

    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!title) return fail("Le titre de l'avis est obligatoire.");
    if (!description) return fail("La description est obligatoire.");
    if (formData.get("signed") !== "true") {
      return fail("Vous devez signer l'avis avant de le diffuser.");
    }

    const type = String(formData.get("type") ?? "PERSON");
    const subjectName = String(formData.get("subjectName") ?? "").trim();

    const bolo = await db.bolo.create({
      data: {
        reference: await nextReference("bolo", "RECHERCHE"),
        title,
        type,
        description,
        priority: String(formData.get("priority") ?? "MEDIUM"),
        // Personne concernée saisie librement ; véhicule toujours par plaque.
        subjectName: type === "PERSON" ? subjectName : "",
        vehicleId: type === "VEHICLE" ? Number(formData.get("vehicleId")) || null : null,
        issuedById: user.id,
        signature: officerSignature(user),
      },
    });

    await audit({
      userId: user.id,
      action: "BOLO_ISSUE",
      targetType: "Bolo",
      targetId: bolo.id,
      detail: `${bolo.reference} — ${title}`,
    });

    revalidatePath("/warrants");
    return { success: `Avis de recherche ${bolo.reference} diffusé.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function closeBolo(formData: FormData) {
  const user = await assertPermission(can.issueWarrant);
  const id = Number(formData.get("boloId"));

  const bolo = await db.bolo.update({
    where: { id },
    data: { status: "CLOSED" },
  });

  await audit({
    userId: user.id,
    action: "BOLO_CLOSE",
    targetType: "Bolo",
    targetId: id,
    detail: bolo.reference,
  });

  revalidatePath("/warrants");
}
