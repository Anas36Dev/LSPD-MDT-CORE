"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { notify } from "@/lib/notify";
import { can, canSuperviseDivision, type SessionUser } from "@/lib/permissions";
import {
  findMissingRequired,
  parseTemplateSchema,
  readFormData,
  toJson,
} from "@/lib/report-schema";
import { officerSignature } from "@/lib/utils";

export type ReportState = { error?: string; success?: string } | undefined;

const fail = (error: string): ReportState => ({ error });

/** Tout agent assermenté peut rédiger un rapport. */
const canWrite = (u: SessionUser) => u.rank.level >= 37 || u.isSuperAdmin;

/**
 * Numéro de dossier séquentiel par préfixe et par année.
 *
 * Le préfixe dépend du type de document (REPORT-ARREST, PLAINTE, DEPOSITION…),
 * si bien que chaque type a sa propre numérotation : REPORT-ARREST-2026-0001,
 * PLAINTE-2026-0001, etc.
 */
async function nextReference(prefix: string) {
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}-`;

  const last = await db.report.findFirst({
    where: { reference: { startsWith: base } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  const lastSeq = last ? Number(last.reference.slice(base.length)) : 0;
  return `${base}${String(lastSeq + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Rédaction
// ---------------------------------------------------------------------------

async function loadTemplate(templateId: number) {
  const template = await db.reportTemplate.findUnique({
    where: { id: templateId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!template) throw new Error("Template introuvable.");
  if (!template.isActive) throw new Error("Ce template a été désactivé.");

  const version = template.versions[0];
  if (!version) throw new Error("Ce template n'a aucune version publiée.");

  return { template, version, schema: parseTemplateSchema(version.schema) };
}

export async function createReport(
  _state: ReportState,
  formData: FormData,
): Promise<ReportState> {
  let reportId: number;

  try {
    const user = await assertPermission(canWrite);
    const templateId = Number(formData.get("templateId"));
    const submit = formData.get("intent") === "submit";

    const { template, version, schema } = await loadTemplate(templateId);

    if (!user.isSuperAdmin && user.rank.level < template.minRankLevel) {
      return fail("Votre grade ne vous permet pas d'utiliser ce template.");
    }

    const data = readFormData(schema, formData);
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return fail("Le titre du rapport est obligatoire.");

    // Les champs obligatoires ne sont exigés qu'à la soumission : on doit
    // pouvoir enregistrer un brouillon incomplet et le reprendre plus tard.
    if (submit) {
      const missing = findMissingRequired(schema, data);
      if (missing.length > 0) {
        return fail(`Champs obligatoires manquants : ${missing.join(", ")}.`);
      }
      if (formData.get("signed") !== "true") {
        return fail("Vous devez signer le document avant de le soumettre.");
      }
    }

    const report = await db.report.create({
      data: {
        reference: await nextReference(template.referencePrefix),
        templateId: template.id,
        templateVersionId: version.id,
        authorId: user.id,
        title,
        data: toJson(data),
        status: submit
          ? template.requiresValidation
            ? "SUBMITTED"
            : "APPROVED"
          : "DRAFT",
        submittedAt: submit ? new Date() : null,
        // La soumission vaut signature : on l'appose au nom de l'auteur.
        authorSignature: submit ? officerSignature(user) : null,
        location: String(formData.get("location") ?? "").trim() || null,
      },
    });
    reportId = report.id;

    await audit({
      userId: user.id,
      action: submit ? "REPORT_SUBMIT" : "REPORT_DRAFT",
      targetType: "Report",
      targetId: report.id,
      detail: `${template.name} — ${report.reference}`,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }

  revalidatePath("/reports");
  redirect(`/reports/${reportId}`);
}

export async function updateReport(
  _state: ReportState,
  formData: FormData,
): Promise<ReportState> {
  try {
    const user = await assertPermission(canWrite);
    const id = Number(formData.get("id"));
    const submit = formData.get("intent") === "submit";

    const report = await db.report.findUnique({
      where: { id },
      include: { template: true, templateVersion: true },
    });
    if (!report) return fail("Rapport introuvable.");

    if (report.authorId !== user.id && !user.isSuperAdmin) {
      return fail("Seul l'auteur peut modifier ce rapport.");
    }
    if (report.status === "APPROVED") {
      return fail("Un rapport validé ne peut plus être modifié.");
    }
    if (report.status === "SUBMITTED") {
      return fail(
        "Ce rapport est en cours de validation. Attendez la décision du superviseur.",
      );
    }

    const schema = parseTemplateSchema(report.templateVersion.schema);
    const data = readFormData(schema, formData);
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return fail("Le titre du rapport est obligatoire.");

    if (submit) {
      const missing = findMissingRequired(schema, data);
      if (missing.length > 0) {
        return fail(`Champs obligatoires manquants : ${missing.join(", ")}.`);
      }
      if (formData.get("signed") !== "true") {
        return fail("Vous devez signer le document avant de le soumettre.");
      }
    }

    await db.report.update({
      where: { id },
      data: {
        title,
        data: toJson(data),
        location: String(formData.get("location") ?? "").trim() || null,
        status: submit
          ? report.template.requiresValidation
            ? "SUBMITTED"
            : "APPROVED"
          : "DRAFT",
        submittedAt: submit ? new Date() : report.submittedAt,
        authorSignature: submit ? officerSignature(user) : report.authorSignature,
      },
    });

    await audit({
      userId: user.id,
      action: submit ? "REPORT_SUBMIT" : "REPORT_UPDATE",
      targetType: "Report",
      targetId: id,
      detail: report.reference,
    });

    revalidatePath(`/reports/${id}`);
    revalidatePath("/reports");
    return {
      success: submit ? "Rapport soumis à validation." : "Brouillon enregistré.",
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export async function reviewReport(
  _state: ReportState,
  formData: FormData,
): Promise<ReportState> {
  try {
    const user = await assertPermission(can.validateReports);
    const id = Number(formData.get("id"));
    const decision = String(formData.get("decision"));
    const comment = String(formData.get("comment") ?? "").trim();

    if (!["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(decision)) {
      return fail("Décision invalide.");
    }

    const report = await db.report.findUnique({
      where: { id },
      include: { author: { include: { divisions: { include: { division: true } } } } },
    });
    if (!report) return fail("Rapport introuvable.");

    if (report.status !== "SUBMITTED") {
      return fail("Ce rapport n'est pas en attente de validation.");
    }

    // Un superviseur peut valider son propre document : il signe alors comme
    // rédigeant (à la soumission) puis comme superviseur (à la validation).
    // Pour les documents d'autrui, il ne valide que dans son périmètre.
    if (report.authorId !== user.id) {
      const authorDivisions = report.author.divisions.map((d) => d.division.code);
      const inScope =
        authorDivisions.length === 0 ||
        authorDivisions.some((code) => canSuperviseDivision(user, code));

      if (!inScope) {
        return fail(
          "Cet agent ne relève pas de votre périmètre de supervision.",
        );
      }
    }

    if ((decision === "REJECTED" || decision === "CHANGES_REQUESTED") && !comment) {
      return fail("Un motif est obligatoire pour refuser ou demander une correction.");
    }

    // La validation officielle exige la signature du superviseur.
    const signed = formData.get("signed") === "true";
    if (decision === "APPROVED" && !signed) {
      return fail("Vous devez signer le rapport pour le valider officiellement.");
    }

    await db.$transaction([
      db.report.update({
        where: { id },
        data: {
          status: decision as "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
        },
      }),
      db.reportValidation.create({
        data: {
          reportId: id,
          reviewerId: user.id,
          decision: decision as "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
          comment: comment || null,
          signature: signed ? officerSignature(user) : null,
        },
      }),
    ]);

    await audit({
      userId: user.id,
      action: `REPORT_${decision}`,
      targetType: "Report",
      targetId: id,
      detail: `${report.reference}${comment ? ` — ${comment}` : ""}`,
    });

    // On avertit l'auteur de la décision, quelle qu'elle soit.
    if (report.authorId !== user.id) {
      const label =
        decision === "APPROVED"
          ? "validé"
          : decision === "REJECTED"
            ? "refusé"
            : "à corriger";
      await notify(report.authorId, {
        type: `REPORT_${decision}`,
        title: `Rapport ${label} — ${report.reference}`,
        body: comment
          ? `${user.rank.name} ${user.lastName} : « ${comment} »`
          : `Votre rapport « ${report.title} » a été ${label} par ${user.rank.name} ${user.lastName}.`,
        link: `/reports/${id}`,
      });
    }

    revalidatePath(`/reports/${id}`);
    revalidatePath("/reports");
    return { success: "Décision enregistrée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function deleteReport(formData: FormData) {
  const id = Number(formData.get("id"));

  const user = await assertPermission(canWrite);
  const report = await db.report.findUnique({
    where: { id },
    include: { template: { select: { category: true } } },
  });
  if (!report) throw new Error("Rapport introuvable.");

  // Un rapport soumis ou validé fait partie du dossier : seul un superviseur
  // peut le retirer, et la suppression reste tracée dans le journal d'audit.
  const isOwnDraft = report.authorId === user.id && report.status === "DRAFT";
  if (!isOwnDraft && !can.validateReports(user)) {
    throw new Error(
      "Seul un superviseur peut supprimer un rapport déjà soumis.",
    );
  }

  await db.report.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "REPORT_DELETE",
    targetType: "Report",
    targetId: id,
    detail: `${report.reference} — ${report.title}`,
  });

  const backTo = report.template.category === "COMPLAINT" ? "/complaints" : "/reports";
  revalidatePath(backTo);
  redirect(backTo);
}
