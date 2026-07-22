/**
 * Statuts de compte agent — source unique pour les libellés, tons et l'ordre.
 * Réutilisé par la gestion des comptes (liste, fiche, formulaire).
 */
export type AccountStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "EXCUSED_ABSENCE"
  | "ADMIN_LEAVE"
  | "SUSPENDED"
  | "DISCHARGED"
  | "RESIGNED"
  | "DECEASED";

type Tone = "green" | "amber" | "red" | "neutral";

export const ACCOUNT_STATUSES: {
  value: AccountStatus;
  label: string;
  tone: Tone;
}[] = [
  { value: "ACTIVE", label: "Actif", tone: "green" },
  { value: "INACTIVE", label: "Inactif", tone: "neutral" },
  { value: "EXCUSED_ABSENCE", label: "Absence justifiée", tone: "amber" },
  { value: "ADMIN_LEAVE", label: "En congé administratif", tone: "amber" },
  { value: "SUSPENDED", label: "Suspendu", tone: "red" },
  { value: "DISCHARGED", label: "Licencié", tone: "neutral" },
  { value: "RESIGNED", label: "Démissionné", tone: "neutral" },
  { value: "DECEASED", label: "Décédé", tone: "red" },
];

export const ACCOUNT_STATUS_MAP: Record<string, { label: string; tone: Tone }> =
  Object.fromEntries(ACCOUNT_STATUSES.map((s) => [s.value, s]));

/** Statuts qui coupent l'accès : l'agent ne peut plus se connecter. */
export const BLOCKING_STATUSES: AccountStatus[] = [
  "SUSPENDED",
  "DISCHARGED",
  "RESIGNED",
  "DECEASED",
];

/** Statuts « a quitté l'effectif » : seuls ceux-ci autorisent une suppression. */
export const LEFT_STATUSES: AccountStatus[] = [
  "DISCHARGED",
  "RESIGNED",
  "DECEASED",
];
