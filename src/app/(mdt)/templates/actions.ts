"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { templateSchema } from "@/lib/report-schema";

export type TemplateState = { error?: string; success?: string } | undefined;

const fail = (error: string): TemplateState => ({ error });

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

function readMeta(formData: FormData) {
  const category =
    String(formData.get("category") ?? "REPORT") === "COMPLAINT"
      ? "COMPLAINT"
      : "REPORT";
  // Préfixe normalisé : majuscules, chiffres et tirets (ex: REPORT-ARREST).
  const referencePrefix =
    String(formData.get("referencePrefix") ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase()
      .replace(/[^A-Z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "LSPD";
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    category,
    referencePrefix,
    minRankLevel: Number(formData.get("minRankLevel")) || 37,
    requiresValidation: formData.get("requiresValidation") === "on",
    isActive: formData.get("isActive") === "on",
  };
}

/** Le schéma arrive du navigateur sous forme de JSON, donc jamais de confiance. */
function readSchema(formData: FormData) {
  const raw = String(formData.get("schema") ?? "[]");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Définition du formulaire illisible.");
  }

  const result = templateSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Définition invalide : ${result.error.issues[0]?.message ?? "structure incorrecte"}.`,
    );
  }

  const schema = result.data;
  if (schema.length === 0) throw new Error("Ajoutez au moins une section.");

  const keys = schema.flatMap((s) => s.fields.map((f) => f.key));
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupes.length > 0) {
    throw new Error(`Clés de champ en double : ${[...new Set(dupes)].join(", ")}.`);
  }

  return schema;
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

export async function createTemplate(
  _state: TemplateState,
  formData: FormData,
): Promise<TemplateState> {
  let newId: number;

  try {
    const user = await assertPermission(can.manageTemplates);
    const meta = readMeta(formData);
    if (!meta.name) return fail("Le nom du template est obligatoire.");

    const schema = readSchema(formData);

    const code = slugify(meta.name);
    if (await db.reportTemplate.findUnique({ where: { code } })) {
      return fail(`Un template porte déjà le code ${code}. Choisissez un autre nom.`);
    }

    const template = await db.reportTemplate.create({
      data: {
        code,
        ...meta,
        createdById: user.id,
        order: 100,
        versions: { create: { version: 1, schema } },
      },
    });
    newId = template.id;

    await audit({
      userId: user.id,
      action: "TEMPLATE_CREATE",
      targetType: "ReportTemplate",
      targetId: template.id,
      detail: meta.name,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }

  revalidatePath("/templates");
  redirect(`/templates/${newId}`);
}

// ---------------------------------------------------------------------------
// Modification
// ---------------------------------------------------------------------------

export async function updateTemplate(
  _state: TemplateState,
  formData: FormData,
): Promise<TemplateState> {
  try {
    const user = await assertPermission(can.manageTemplates);
    const id = Number(formData.get("id"));

    const template = await db.reportTemplate.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!template) return fail("Template introuvable.");

    const meta = readMeta(formData);
    if (!meta.name) return fail("Le nom du template est obligatoire.");

    const schema = readSchema(formData);
    const latest = template.versions[0];

    // Une nouvelle version n'est publiée QUE si la structure change. Sans cela,
    // renommer un template gonflerait l'historique sans raison.
    const structureChanged =
      !latest || JSON.stringify(latest.schema) !== JSON.stringify(schema);

    await db.reportTemplate.update({ where: { id }, data: meta });

    if (structureChanged) {
      await db.reportTemplateVersion.create({
        data: {
          templateId: id,
          version: (latest?.version ?? 0) + 1,
          schema,
        },
      });
    }

    await audit({
      userId: user.id,
      action: "TEMPLATE_UPDATE",
      targetType: "ReportTemplate",
      targetId: id,
      detail: structureChanged
        ? `${meta.name} — nouvelle version ${(latest?.version ?? 0) + 1}`
        : `${meta.name} — métadonnées`,
    });

    revalidatePath(`/templates/${id}`);
    revalidatePath("/templates");
    revalidatePath("/reports/new");
    revalidatePath("/complaints/new");

    return {
      success: structureChanged
        ? `Version ${(latest?.version ?? 0) + 1} publiée. Les rapports existants conservent leur version d'origine.`
        : "Template mis à jour.",
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

// ---------------------------------------------------------------------------
// Désactivation
// ---------------------------------------------------------------------------

export async function toggleTemplate(formData: FormData) {
  const user = await assertPermission(can.manageTemplates);
  const id = Number(formData.get("id"));

  const template = await db.reportTemplate.findUnique({ where: { id } });
  if (!template) throw new Error("Template introuvable.");

  await db.reportTemplate.update({
    where: { id },
    data: { isActive: !template.isActive },
  });

  await audit({
    userId: user.id,
    action: template.isActive ? "TEMPLATE_DISABLE" : "TEMPLATE_ENABLE",
    targetType: "ReportTemplate",
    targetId: id,
    detail: template.name,
  });

  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
}
