import { z } from "zod";

/**
 * Définition des templates de rapports.
 *
 * Un template est une liste de sections, chaque section contenant des champs.
 * Cette définition est stockée en JSON dans `ReportTemplateVersion.schema` :
 * modifier un template crée une NOUVELLE version, si bien qu'un rapport déjà
 * soumis reste lisible avec la structure qui avait cours au moment de sa
 * rédaction.
 */

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "select",
  "multiselect",
  "checkbox",
  "officer_picker",
  "civilian_picker",
  "vehicle_picker",
  "penal_code_picker",
  "signature",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texte court",
  textarea: "Texte long",
  number: "Nombre",
  date: "Date",
  datetime: "Date et heure",
  select: "Liste déroulante",
  multiselect: "Choix multiples",
  checkbox: "Case à cocher",
  officer_picker: "Sélection d'agent",
  civilian_picker: "Sélection de civil",
  vehicle_picker: "Sélection de véhicule",
  penal_code_picker: "Chefs d'inculpation",
  signature: "Signature",
};

/** Types dont les valeurs sont des listes. */
export const MULTI_TYPES: FieldType[] = [
  "multiselect",
  "officer_picker",
  "penal_code_picker",
];

export const fieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Clé : minuscules, chiffres et tirets bas"),
  label: z.string().min(1, "Libellé requis"),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional(),
  help: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const sectionSchema = z.object({
  title: z.string().min(1, "Titre de section requis"),
  fields: z.array(fieldSchema),
});

export const templateSchema = z.array(sectionSchema);

export type ReportField = z.infer<typeof fieldSchema>;
export type ReportSection = z.infer<typeof sectionSchema>;
export type TemplateSchema = z.infer<typeof templateSchema>;

/** Lecture défensive d'un schéma stocké en base. */
export function parseTemplateSchema(raw: unknown): TemplateSchema {
  const parsed = templateSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export const allFields = (schema: TemplateSchema) =>
  schema.flatMap((s) => s.fields);

// ---------------------------------------------------------------------------
// Valeurs saisies
// ---------------------------------------------------------------------------

export type ReportData = Record<string, unknown>;

/**
 * Prisma attend un `InputJsonValue` pour une colonne Json, type plus strict que
 * `Record<string, unknown>`. Les valeurs produites par `readFormData` sont par
 * construction sérialisables (chaînes, nombres, booléens, tableaux, null), donc
 * la conversion est sûre — c'est le typage qui ne peut pas le démontrer seul.
 */
export const toJson = (data: ReportData) =>
  data as unknown as Record<string, string | number | boolean | null | string[]>;

/**
 * Extrait les valeurs d'un formulaire selon la définition du template.
 * Le typage des valeurs suit le type déclaré du champ, ce qui garantit qu'un
 * nombre reste un nombre et une liste une liste, quelle que soit la façon dont
 * le navigateur a encodé le formulaire.
 */
export function readFormData(
  schema: TemplateSchema,
  formData: FormData,
): ReportData {
  const data: ReportData = {};

  for (const field of allFields(schema)) {
    const name = `f_${field.key}`;

    if (MULTI_TYPES.includes(field.type)) {
      data[field.key] = formData.getAll(name).map(String).filter(Boolean);
      continue;
    }

    const raw = formData.get(name);

    if (field.type === "checkbox") {
      data[field.key] = raw === "on" || raw === "true";
      continue;
    }

    if (field.type === "number") {
      const value = String(raw ?? "").trim();
      data[field.key] = value === "" ? null : Number(value);
      continue;
    }

    data[field.key] = raw === null ? null : String(raw);
  }

  return data;
}

/** Contrôle les champs obligatoires. Retourne les libellés manquants. */
export function findMissingRequired(
  schema: TemplateSchema,
  data: ReportData,
): string[] {
  const missing: string[] = [];

  for (const field of allFields(schema)) {
    if (!field.required) continue;
    const value = data[field.key];

    const empty =
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0) ||
      (field.type === "checkbox" && value !== true);

    if (empty) missing.push(field.label);
  }

  return missing;
}

// ---------------------------------------------------------------------------
// Calcul de peine
// ---------------------------------------------------------------------------

export type PenalEntry = {
  code: string;
  title: string;
  category?: string;
  fine: number | null;
  jailTime: number | null;
  isLifeSentence?: boolean;
  requiresDoj?: boolean;
};

export type SentenceResult = {
  totalFine: number;
  /** Peine retenue : la plus longue, jamais la somme. */
  jailTime: number;
  longestCharge: string | null;
  officerReduction: number;
  lawyerReduction: number;
  finalJailTime: number;
  /** Au-delà de 10 minutes, une réduction d'avocat exige l'accord du Command Staff. */
  requiresCommandApproval: boolean;
  /** Convoi fédéral obligatoire à partir de 60 minutes. */
  requiresFederalConvoy: boolean;
  /** Une peine de perpétuité prime sur toute peine chiffrée. */
  isLifeSentence: boolean;
  /** Au moins un chef d'inculpation relève du Department of Justice. */
  requiresDoj: boolean;
};

/** Réduction maximale que l'agent peut accorder de sa propre initiative. */
export const MAX_OFFICER_REDUCTION = 10;
/** Seuil au-delà duquel une réduction d'avocat exige le Command Staff. */
export const COMMAND_APPROVAL_THRESHOLD = 10;
/** Peine à partir de laquelle le convoi fédéral est obligatoire. */
export const FEDERAL_CONVOY_THRESHOLD = 60;

export const LAWYER_REDUCTIONS = {
  NONE: { label: "Aucun avocat", rate: 0 },
  COMMIS_OFFICE: { label: "Avocat commis d'office", rate: 0.15 },
  SOUS_CONTRAT: { label: "Avocat sous contrat", rate: 0.5 },
} as const;

export type LawyerKind = keyof typeof LAWYER_REDUCTIONS;

/**
 * Calcule la peine selon la fiche circulaire 1.2 :
 * « Les amendes sont cumulables mais pas la peine de prison.
 *   C'est toujours la peine de prison la plus longue qui prime ! »
 */
export function computeSentence(
  charges: PenalEntry[],
  options: {
    officerReduction?: number;
    lawyer?: LawyerKind;
  } = {},
): SentenceResult {
  const totalFine = charges.reduce((sum, c) => sum + (c.fine ?? 0), 0);
  const requiresDoj = charges.some((c) => c.requiresDoj);

  // La perpétuité n'est pas comparable à une durée : dès qu'un chef
  // d'inculpation l'entraîne, elle s'impose et aucune remise ne s'applique.
  const lifeCharge = charges.find((c) => c.isLifeSentence);
  if (lifeCharge) {
    return {
      totalFine,
      jailTime: 0,
      longestCharge: lifeCharge.title,
      officerReduction: 0,
      lawyerReduction: 0,
      finalJailTime: 0,
      requiresCommandApproval: false,
      requiresFederalConvoy: true,
      isLifeSentence: true,
      requiresDoj,
    };
  }

  let jailTime = 0;
  let longestCharge: string | null = null;
  for (const c of charges) {
    if ((c.jailTime ?? 0) > jailTime) {
      jailTime = c.jailTime ?? 0;
      longestCharge = c.title;
    }
  }

  const officerReduction = Math.min(
    Math.max(0, options.officerReduction ?? 0),
    MAX_OFFICER_REDUCTION,
  );

  const lawyer = options.lawyer ?? "NONE";
  const lawyerReduction = Math.round(jailTime * LAWYER_REDUCTIONS[lawyer].rate);

  const finalJailTime = Math.max(
    0,
    jailTime - officerReduction - lawyerReduction,
  );

  return {
    totalFine,
    jailTime,
    longestCharge,
    officerReduction,
    lawyerReduction,
    finalJailTime,
    requiresCommandApproval:
      lawyerReduction > 0 && jailTime > COMMAND_APPROVAL_THRESHOLD,
    requiresFederalConvoy: finalJailTime >= FEDERAL_CONVOY_THRESHOLD,
    isLifeSentence: false,
    requiresDoj,
  };
}

/** Catégories du code pénal de San Andreas, de la plus légère à la plus grave. */
export const PENAL_CATEGORIES = [
  "CONTRAVENTION",
  "DELIT MINEUR",
  "DELIT MAJEUR",
  "CRIME",
  "CRIME FEDERAL",
  "CRIME FINANCIER",
] as const;

export const PENAL_CATEGORY_LABELS: Record<string, string> = {
  CONTRAVENTION: "Contravention",
  "DELIT MINEUR": "Délit mineur",
  "DELIT MAJEUR": "Délit majeur",
  CRIME: "Crime",
  "CRIME FEDERAL": "Crime fédéral",
  "CRIME FINANCIER": "Crime financier",
};

export const PENAL_CATEGORY_TONES: Record<
  string,
  "neutral" | "blue" | "amber" | "red" | "gold"
> = {
  CONTRAVENTION: "neutral",
  "DELIT MINEUR": "blue",
  "DELIT MAJEUR": "amber",
  CRIME: "red",
  "CRIME FEDERAL": "red",
  "CRIME FINANCIER": "gold",
};

// ---------------------------------------------------------------------------
// Référence de rapport
// ---------------------------------------------------------------------------

/** LSPD-2026-000123 */
export const buildReference = (year: number, sequence: number) =>
  `LSPD-${year}-${String(sequence).padStart(6, "0")}`;
