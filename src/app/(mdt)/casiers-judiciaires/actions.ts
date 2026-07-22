"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { isSupervisor, isSworn } from "@/lib/permissions";
import { nextCasierReference, nextInfractionReference } from "@/lib/references";
import { officerSignature } from "@/lib/utils";

export type CivilState = { error?: string; success?: string } | undefined;

const fail = (error: string): CivilState => ({ error });

const optionalDate = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

// ---------------------------------------------------------------------------
// Fiches (casiers judiciaires)
// ---------------------------------------------------------------------------

const civilianSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis"),
  lastName: z.string().trim().min(1, "Nom requis"),
});

/** Champs d'identité communs à la création et à l'édition. */
function readCivilian(formData: FormData) {
  const gender = String(formData.get("gender") ?? "").trim();
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    dateOfBirth: optionalDate(formData.get("dateOfBirth")),
    placeOfBirth: text(formData.get("placeOfBirth")),
    nationality: text(formData.get("nationality")),
    gender: gender === "Homme" || gender === "Femme" ? gender : null,
    address: text(formData.get("address")),
    phone: text(formData.get("phone")),
    height: text(formData.get("height")),
    weight: text(formData.get("weight")),
    eyeColor: text(formData.get("eyeColor")),
    hairColor: text(formData.get("hairColor")),
    hasTattoos: formData.get("hasTattoos") === "on",
    tattoosDescription: text(formData.get("tattoosDescription")),
    groupuscule: text(formData.get("groupuscule")),
    photoUrl: text(formData.get("photoUrl")),
    notes: text(formData.get("notes")),
    isFlagged: formData.get("isFlagged") === "on",
    flagReason: text(formData.get("flagReason")),
  };
}

export async function createCivilian(
  _state: CivilState,
  formData: FormData,
): Promise<CivilState> {
  let newId: number;

  try {
    const user = await assertPermission(isSworn);
    const data = readCivilian(formData);

    const parsed = civilianSchema.safeParse(data);
    if (!parsed.success) return fail(parsed.error.issues[0].message);

    if (data.isFlagged && !data.flagReason) {
      return fail("Un signalement de dangerosité doit être motivé.");
    }
    if (formData.get("signed") !== "true") {
      return fail("Vous devez signer le casier avant de l'enregistrer.");
    }

    const civilian = await db.civilian.create({
      data: {
        ...data,
        // Les tatouages sans description restent un simple « oui ».
        tattoosDescription: data.hasTattoos ? data.tattoosDescription : null,
        reference: await nextCasierReference(),
        authorId: user.id,
        authorSignature: officerSignature(user),
      },
    });
    newId = civilian.id;

    await audit({
      userId: user.id,
      action: "CIVILIAN_CREATE",
      targetType: "Civilian",
      targetId: civilian.id,
      detail: `${civilian.reference} · ${data.firstName} ${data.lastName}`,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }

  revalidatePath("/casiers-judiciaires");
  redirect(`/casiers-judiciaires/${newId}`);
}

export async function updateCivilian(
  _state: CivilState,
  formData: FormData,
): Promise<CivilState> {
  try {
    const user = await assertPermission(isSworn);
    const id = Number(formData.get("id"));
    const data = readCivilian(formData);

    const parsed = civilianSchema.safeParse(data);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    if (data.isFlagged && !data.flagReason) {
      return fail("Un signalement de dangerosité doit être motivé.");
    }

    await db.civilian.update({
      where: { id },
      data: {
        ...data,
        tattoosDescription: data.hasTattoos ? data.tattoosDescription : null,
      },
    });

    await audit({
      userId: user.id,
      action: "CIVILIAN_UPDATE",
      targetType: "Civilian",
      targetId: id,
      detail: `${data.firstName} ${data.lastName}`,
    });

    revalidatePath(`/casiers-judiciaires/${id}`);
    revalidatePath("/casiers-judiciaires");
    return { success: "Casier enregistré." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

/** Validation du casier par un superviseur (signature obligatoire). */
export async function validateCivilian(
  _state: CivilState,
  formData: FormData,
): Promise<CivilState> {
  try {
    const user = await assertPermission(isSupervisor);
    const id = Number(formData.get("id"));

    if (formData.get("signed") !== "true") {
      return fail("Vous devez signer pour valider le casier.");
    }

    await db.civilian.update({
      where: { id },
      data: {
        validatedById: user.id,
        validatedAt: new Date(),
        validationSignature: officerSignature(user),
      },
    });

    await audit({
      userId: user.id,
      action: "CIVILIAN_VALIDATE",
      targetType: "Civilian",
      targetId: id,
    });

    revalidatePath(`/casiers-judiciaires/${id}`);
    return { success: "Casier validé." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deleteCivilian(formData: FormData) {
  const user = await assertPermission(isSupervisor);
  const id = Number(formData.get("id"));

  const civilian = await db.civilian.findUnique({ where: { id } });
  if (!civilian) throw new Error("Casier introuvable.");

  await db.civilian.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "CIVILIAN_DELETE",
    targetType: "Civilian",
    targetId: id,
    detail: `${civilian.reference} · ${civilian.firstName} ${civilian.lastName}`,
  });

  revalidatePath("/casiers-judiciaires");
  redirect("/casiers-judiciaires");
}

// ---------------------------------------------------------------------------
// Rapports rattachés au casier (niveau fiche)
// ---------------------------------------------------------------------------

export async function linkCivilianReport(
  _state: CivilState,
  formData: FormData,
): Promise<CivilState> {
  try {
    const user = await assertPermission(isSworn);
    const civilianId = Number(formData.get("civilianId"));
    const reference = String(formData.get("reportRef") ?? "").trim();
    if (!reference) return fail("Indiquez la référence du rapport.");

    const report = await db.report.findUnique({ where: { reference } });
    if (!report) {
      return fail("Rapport introuvable — référence exacte requise.");
    }

    const existing = await db.civilianReport.findUnique({
      where: { civilianId_reportId: { civilianId, reportId: report.id } },
    });
    if (existing) return fail("Ce rapport est déjà rattaché au casier.");

    await db.civilianReport.create({
      data: { civilianId, reportId: report.id },
    });

    await audit({
      userId: user.id,
      action: "CIVILIAN_REPORT_LINK",
      targetType: "Civilian",
      targetId: civilianId,
      detail: reference,
    });

    revalidatePath(`/casiers-judiciaires/${civilianId}`);
    return { success: `Rapport ${reference} rattaché.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function unlinkCivilianReport(formData: FormData) {
  const user = await assertPermission(isSworn);
  const civilianId = Number(formData.get("civilianId"));
  const reportId = Number(formData.get("reportId"));

  await db.civilianReport
    .delete({ where: { civilianId_reportId: { civilianId, reportId } } })
    .catch(() => {});

  await audit({
    userId: user.id,
    action: "CIVILIAN_REPORT_UNLINK",
    targetType: "Civilian",
    targetId: civilianId,
  });

  revalidatePath(`/casiers-judiciaires/${civilianId}`);
}

// ---------------------------------------------------------------------------
// Infractions du casier
// ---------------------------------------------------------------------------

const numberList = (values: FormDataEntryValue[]) => [
  ...new Set(
    values.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0),
  ),
];

export async function addCriminalRecord(
  _state: CivilState,
  formData: FormData,
): Promise<CivilState> {
  try {
    const user = await assertPermission(isSworn);
    const civilianId = Number(formData.get("civilianId"));
    const description = String(formData.get("description") ?? "").trim();

    if (!description) return fail("La description des faits est obligatoire.");

    const civilian = await db.civilian.findUnique({
      where: { id: civilianId },
      select: { reference: true },
    });
    if (!civilian) return fail("Casier introuvable.");

    // Motifs (code pénal), rapports liés et renvois vers d'autres infractions.
    const penalCodeIds = numberList(formData.getAll("penalCodeId"));
    const reportIds = numberList(formData.getAll("reportId"));
    const refRecordIds = numberList(formData.getAll("refRecordId")).filter(
      // Une infraction ne se référence pas elle-même : impossible avant création,
      // mais on garde le filtre par sécurité côté données saisies.
      (n) => n !== 0,
    );

    // Seuls des rapports/infractions réellement existants sont rattachés.
    const [validReports, validRecords] = await Promise.all([
      reportIds.length
        ? db.report.findMany({
            where: { id: { in: reportIds } },
            select: { id: true },
          })
        : [],
      refRecordIds.length
        ? db.criminalRecord.findMany({
            where: { id: { in: refRecordIds }, civilianId },
            select: { id: true },
          })
        : [],
    ]);

    await db.criminalRecord.create({
      data: {
        civilianId,
        reference: await nextInfractionReference(civilianId, civilian.reference),
        authorId: user.id,
        description,
        sentence: text(formData.get("sentence")),
        fine: Number(formData.get("fine")) || null,
        observations: text(formData.get("observations")),
        occurredAt: optionalDate(formData.get("occurredAt")) ?? new Date(),
        charges: {
          create: penalCodeIds.map((penalCodeId) => ({ penalCodeId })),
        },
        linkedReports: {
          create: validReports.map((r) => ({ reportId: r.id })),
        },
        references: {
          create: validRecords.map((r) => ({ toId: r.id })),
        },
      },
    });

    await audit({
      userId: user.id,
      action: "CRIMINAL_RECORD_ADD",
      targetType: "Civilian",
      targetId: civilianId,
      detail: description.slice(0, 120),
    });

    revalidatePath(`/casiers-judiciaires/${civilianId}`);
    return { success: "Infraction ajoutée au casier." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deleteCriminalRecord(formData: FormData) {
  const user = await assertPermission(isSupervisor);
  const id = Number(formData.get("recordId"));
  const civilianId = Number(formData.get("civilianId"));

  await db.criminalRecord.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "CRIMINAL_RECORD_DELETE",
    targetType: "Civilian",
    targetId: civilianId,
  });

  revalidatePath(`/casiers-judiciaires/${civilianId}`);
}
