/**
 * Moteur de permissions — SOURCE DE VÉRITÉ UNIQUE.
 *
 * Ce fichier est utilisé à la fois par :
 *   - le rendu du menu (src/components/layout/sidebar.tsx)
 *   - la protection des pages et des Server Actions (src/lib/guard.ts)
 *
 * Ne jamais dupliquer une règle de droit ailleurs : si le menu et le serveur
 * divergent, on obtient soit un module fantôme, soit une faille.
 */

// ---------------------------------------------------------------------------
// Seuils de grade
// ---------------------------------------------------------------------------

export const RANK = {
  CHIEF_OF_POLICE: 100,
  ASSISTANT_CHIEF: 95,
  DEPUTY_CHIEF: 90,
  COMMANDER: 85,
  CAPTAIN_I: 78,
  LIEUTENANT_I: 69,
  SERGEANT_II: 60,
  SERGEANT_I: 59,
  DETECTIVE_III: 55,
  DETECTIVE_I: 53,
  POLICE_OFFICER_II: 38,
  POLICE_OFFICER_I: 37,
  /** Seul grade d'entrée du département. */
  ROOKIE: 10,
} as const;

/** Grade minimum pour être considéré comme superviseur. */
export const SUPERVISOR_LEVEL = RANK.SERGEANT_I;
/** Grade minimum pour faire partie du Command Staff. */
export const COMMAND_LEVEL = RANK.COMMANDER;
/** Grade minimum pour créer un compte agent. */
export const CREATE_ACCOUNT_LEVEL = RANK.DEPUTY_CHIEF;
/** Grade minimum pour suspendre / désactiver un compte agent. */
export const SUSPEND_ACCOUNT_LEVEL = RANK.ASSISTANT_CHIEF;
/** À partir de ce niveau, l'agent est assermenté (sorti de l'académie). */
export const SWORN_LEVEL = RANK.POLICE_OFFICER_I;

/**
 * Grade minimum pour être affecté à une division.
 *
 * Fiche circulaire 1.1 — Apprentissage, § 3 :
 * « Les divisions sont accessibles qu'à partir du grade d'Officier II. »
 */
export const DIVISION_MIN_LEVEL = RANK.POLICE_OFFICER_II;

/**
 * Un agent peut-il être affecté à cette division, compte tenu de son grade ?
 *
 * Le grade plancher est propre à chaque division (`minRankLevel`) et se règle
 * depuis le module « Pôles / spécialités » du Command Staff. Valeurs par
 * défaut issues de la fiche circulaire 1.1 : Patrol dès Officer I (37), les
 * divisions spécialisées à partir d'Officer II (38).
 */
export function canHoldDivision(
  rankLevel: number,
  minRankLevel: number,
  isSuperAdmin = false,
): boolean {
  if (isSuperAdmin) return true;
  return rankLevel >= minRankLevel;
}

/**
 * Grade à partir duquel le commandement pilote le dispatch.
 *
 * Fiche circulaire 1.4 : le Lieutenant I est « prioritaire sur l'organisation
 * des dispatch ». Tous les grades supérieurs en héritent.
 */
export const DISPATCH_COMMAND_LEVEL = RANK.LIEUTENANT_I;

// ---------------------------------------------------------------------------
// Représentation de l'agent connecté
// ---------------------------------------------------------------------------

export type SessionDivision = {
  id: number;
  code: string;
  name: string;
  isPrimary: boolean;
};

export type SessionDivisionRole = {
  code: string;
  name: string;
  divisionCode: string;
  subDivisionCode: string | null;
  isDivisionChief: boolean;
  isUnitLead: boolean;
  canTrain: boolean;
};

export type SessionUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  badgeNumber: string;
  status:
    | "ACTIVE"
    | "INACTIVE"
    | "EXCUSED_ABSENCE"
    | "ADMIN_LEAVE"
    | "SUSPENDED"
    | "DISCHARGED"
    | "RESIGNED"
    | "DECEASED";
  isSuperAdmin: boolean;
  rank: { code: string; name: string; level: number; category: string };
  /** Un agent peut servir dans plusieurs divisions simultanément. */
  divisions: SessionDivision[];
  divisionRoles: SessionDivisionRole[];
  subDivisionCodes: string[];
  certificationCodes: string[];
  unionRole: "REPRESENTATIVE" | "MEMBER" | null;
  /**
   * Renseigné uniquement quand le chef du département visualise le terminal
   * sous un autre grade. Toute écriture est alors refusée.
   */
  preview?: {
    active: true;
    realName: string;
    realRankName: string;
  } | null;
};

/** Le terminal est-il consulté en mode aperçu ? */
export const isPreviewing = (u: SessionUser) => u.preview?.active === true;

// ---------------------------------------------------------------------------
// Prédicats de base
// ---------------------------------------------------------------------------

export const atLeast = (u: SessionUser, level: number) =>
  u.isSuperAdmin || u.rank.level >= level;

/** Personnel du Department of Justice — grade externe, pas un agent du LSPD. */
export const isDoj = (u: SessionUser) => u.rank.code === "DOJ";

/** Rookie : accès strictement limité à l'académie. Le DOJ n'en est pas. */
export const isAcademyTrainee = (u: SessionUser) =>
  !u.isSuperAdmin && !isDoj(u) && u.rank.level < SWORN_LEVEL;

export const isSworn = (u: SessionUser) => !isAcademyTrainee(u) && !isDoj(u);
export const isSupervisor = (u: SessionUser) => atLeast(u, SUPERVISOR_LEVEL);
export const isCommandStaff = (u: SessionUser) => atLeast(u, COMMAND_LEVEL);

/**
 * Chef du département : autorité suprême, sans supérieur hiérarchique.
 *
 * La règle anti-escalade habituelle — « on n'administre qu'un grade
 * strictement inférieur au sien » — ne peut pas s'appliquer à lui : personne
 * n'étant au-dessus, sa propre fiche deviendrait immodifiable. Il échappe donc
 * à cette restriction et peut administrer l'ensemble des comptes, y compris le
 * sien et ceux de même rang.
 */
export const isDepartmentHead = (u: SessionUser) =>
  u.isSuperAdmin || u.rank.level >= RANK.CHIEF_OF_POLICE;

/** Division principale, utilisée pour l'affichage compact. */
export const primaryDivision = (u: SessionUser) =>
  u.divisions.find((d) => d.isPrimary) ?? u.divisions[0] ?? null;

export const inDivision = (u: SessionUser, code: string) =>
  u.divisions.some((d) => d.code === code);

export const divisionCodes = (u: SessionUser) => u.divisions.map((d) => d.code);

export const hasCertification = (u: SessionUser, code: string) =>
  u.isSuperAdmin || u.certificationCodes.includes(code);

export const isUnionRepresentative = (u: SessionUser) =>
  u.unionRole === "REPRESENTATIVE";

/** Chef de la division indiquée (ou de n'importe quelle division si omise). */
export const isDivisionChief = (u: SessionUser, divisionCode?: string) =>
  u.isSuperAdmin ||
  u.divisionRoles.some(
    (r) =>
      r.isDivisionChief && (!divisionCode || r.divisionCode === divisionCode),
  );

/** Responsable d'une sous-unité (ex: Instructor d'un peloton Metro). */
export const isUnitLead = (u: SessionUser, subDivisionCode?: string) =>
  u.isSuperAdmin ||
  u.divisionRoles.some(
    (r) =>
      r.isUnitLead && (!subDivisionCode || r.subDivisionCode === subDivisionCode),
  );

/** Habilité à former et évaluer (académie, FTO, instructeurs de division). */
export const canTrain = (u: SessionUser) =>
  u.isSuperAdmin || u.divisionRoles.some((r) => r.canTrain);

/**
 * Superviseur au sens large : soit par le grade, soit par un rôle de
 * commandement interne à une division. Un Chief of Air Support Division
 * supervise l'ASD même s'il n'est pas Sergeant.
 */
export const hasSupervisoryAuthority = (u: SessionUser) =>
  isSupervisor(u) || isDivisionChief(u) || isUnitLead(u);

/**
 * Périmètre de supervision : sur quelles divisions l'agent a-t-il autorité ?
 * `null` = toutes (Command Staff et superadmin).
 */
export const supervisoryScope = (u: SessionUser): string[] | null => {
  if (u.isSuperAdmin || isCommandStaff(u)) return null;
  const scope = new Set<string>();
  for (const r of u.divisionRoles) {
    if (r.isDivisionChief || r.isUnitLead) scope.add(r.divisionCode);
  }
  // Un Sergeant/Lieutenant supervise les divisions où il est affecté.
  if (isSupervisor(u)) for (const d of u.divisions) scope.add(d.code);
  return [...scope];
};

export const canSuperviseDivision = (u: SessionUser, divisionCode: string) => {
  const scope = supervisoryScope(u);
  return scope === null || scope.includes(divisionCode);
};

// ---------------------------------------------------------------------------
// Espaces de division (Documents / Supervision par pôle) et académie
// ---------------------------------------------------------------------------

/** Voir l'espace d'une division (onglet Documents + apparition du groupe). */
export const canViewDivisionSpace = (u: SessionUser, code: string) =>
  u.isSuperAdmin || isCommandStaff(u) || inDivision(u, code);

/** Diffuser un document dans une division : chefs et instructeurs de son périmètre. */
export const canManageDivisionDocs = (u: SessionUser, code: string) =>
  u.isSuperAdmin ||
  isCommandStaff(u) ||
  u.divisionRoles.some(
    (r) =>
      r.divisionCode === code &&
      (r.isDivisionChief || r.isUnitLead || r.canTrain),
  );

/**
 * Superviser une division : voir tous ses agents et écrire des notes privées.
 * Réservé aux chefs/instructeurs de la division et au Command Staff. Le Bureau
 * des détectives ouvre en plus la supervision aux Detective III et au-dessus.
 */
export const canSuperviseDivisionSpace = (u: SessionUser, code: string) =>
  u.isSuperAdmin ||
  isCommandStaff(u) ||
  isDivisionChief(u, code) ||
  u.divisionRoles.some(
    (r) => r.divisionCode === code && (r.isUnitLead || r.canTrain),
  ) ||
  (code === "DB" && inDivision(u, code) && atLeast(u, RANK.DETECTIVE_III));

/** Consulter les documents pédagogiques de l'académie. */
export const canViewAcademyDocs = (u: SessionUser) =>
  isAcademyTrainee(u) || can.manageAcademy(u) || isCommandStaff(u);

/**
 * Déposer un document pédagogique : chefs et instructeurs de l'académie, plus
 * le Command Staff / Chief Office — comme pour les documents de division.
 */
export const canManageAcademyDocs = (u: SessionUser) =>
  can.manageAcademy(u) || isCommandStaff(u);

/** Accéder aux enquêtes : membres du Detective Bureau et Command Staff. */
export const canAccessInvestigations = (u: SessionUser) =>
  u.isSuperAdmin || isCommandStaff(u) || inDivision(u, "DB");

/**
 * Constituer et consulter des dossiers de preuves : réservé aux agents à partir
 * du grade de Police Officer II (même seuil que l'accès aux divisions).
 */
export const canUseEvidence = (u: SessionUser) =>
  u.isSuperAdmin || atLeast(u, DIVISION_MIN_LEVEL);

/** Field Training Officer : rôle interne `TD_FTO` de la Training Division. */
export const isFTO = (u: SessionUser) =>
  u.isSuperAdmin || u.divisionRoles.some((r) => r.code === "TD_FTO");

/**
 * Voir l'onglet Binômes : les Field Training Officers, les Police Officer I, et
 * tous les grades à partir de Sergeant I — hors détectives — plus le Command Staff.
 */
export const canViewBinomes = (u: SessionUser) =>
  u.isSuperAdmin ||
  isCommandStaff(u) ||
  isFTO(u) ||
  u.rank.level === RANK.POLICE_OFFICER_I ||
  (u.rank.level >= SUPERVISOR_LEVEL && u.rank.category !== "DETECTIVE_STAFF");

/** Créer / réassigner / annoter les binômes : à partir de Sergeant II. */
export const canManageBinomes = (u: SessionUser) => atLeast(u, RANK.SERGEANT_II);

/** Convoquer un agent dans un bureau ou un lieu : à partir de Sergeant II. */
export const canConvene = (u: SessionUser) =>
  u.isSuperAdmin || atLeast(u, RANK.SERGEANT_II);

/** Consulter les retours (Feedback) : Chief of Police et Assistant Chief seulement. */
export const canReviewFeedback = (u: SessionUser) =>
  u.isSuperAdmin || atLeast(u, RANK.ASSISTANT_CHIEF);

/** Rédiger le récapitulatif de réunion hebdomadaire : à partir de Lieutenant I. */
export const canManageMeetings = (u: SessionUser) =>
  u.isSuperAdmin || atLeast(u, RANK.LIEUTENANT_I);

/**
 * Encadrer l'académie : seuls les Instructor of Academy (rôle rattaché au RTS,
 * `canTrain` sur la Training Division) et le Command Staff notent les Rookies.
 */
export const canSuperviseAcademy = (u: SessionUser) =>
  u.isSuperAdmin || isCommandStaff(u) || can.evaluateTrainees(u);

/** Créer et gérer les promotions académiques — Chief Office (Deputy Chief+). */
export const canManagePromotions = (u: SessionUser) =>
  atLeast(u, RANK.DEPUTY_CHIEF);

// ---------------------------------------------------------------------------
// Droits par action
// ---------------------------------------------------------------------------

export const can = {
  /** Créer un compte agent — à partir de Deputy Chief. */
  createAccount: (u: SessionUser) => atLeast(u, CREATE_ACCOUNT_LEVEL),

  /** Suspendre / réactiver / décharger un compte — à partir d'Assistant Chief. */
  suspendAccount: (u: SessionUser) => atLeast(u, SUSPEND_ACCOUNT_LEVEL),

  /** Réinitialiser le mot de passe d'un agent (l'agent ne le peut jamais lui-même). */
  resetPassword: (u: SessionUser) => atLeast(u, CREATE_ACCOUNT_LEVEL),

  /** Modifier grade, divisions et rôles d'un agent. */
  editRoster: (u: SessionUser) => hasSupervisoryAuthority(u),

  /**
   * Officialiser un Police Officer I (Probationary Officer) en Police Officer II
   * (Executive Staff). Ouvert aux superviseurs et aux instructeurs de
   * l'académie, sans passer par la gestion des comptes.
   */
  officialize: (u: SessionUser) => hasSupervisoryAuthority(u) || canTrain(u),

  /** Imposer une photo de profil à la place de celle de Discord. */
  setAvatar: (u: SessionUser) => hasSupervisoryAuthority(u),

  /** Créer et modifier les templates de rapports. */
  manageTemplates: (u: SessionUser) => hasSupervisoryAuthority(u),

  /** Valider ou refuser un rapport soumis. */
  validateReports: (u: SessionUser) => hasSupervisoryAuthority(u),

  /** Éditer les codes radio et le code pénal. */
  editRadioCodes: (u: SessionUser) => isSupervisor(u),

  /** Publier une annonce départementale. */
  publishAnnouncement: (u: SessionUser) =>
    hasSupervisoryAuthority(u) || isUnionRepresentative(u),

  /** Émettre un mandat ou un BOLO. */
  issueWarrant: (u: SessionUser) => isSworn(u),

  /** Attribuer ou retirer une certification PPA / Lincoln Patrol. */
  awardCertification: (u: SessionUser) => hasSupervisoryAuthority(u),

  /** Décerner une médaille — Command Staff uniquement. */
  awardMedal: (u: SessionUser) => isCommandStaff(u),

  /** Consulter les dossiers disciplinaires — IAD et Command Staff uniquement. */
  viewIaCases: (u: SessionUser) =>
    u.isSuperAdmin || inDivision(u, "IAD") || isCommandStaff(u),

  /** Clore un dossier disciplinaire — le Chief of IAD seulement. */
  closeIaCase: (u: SessionUser) =>
    u.isSuperAdmin ||
    isDivisionChief(u, "IAD") ||
    atLeast(u, RANK.CHIEF_OF_POLICE),

  /** Déposer cours et documents d'académie. */
  manageAcademy: (u: SessionUser) =>
    u.isSuperAdmin || isDivisionChief(u, "TD") || canTrain(u),

  /** Évaluer une recrue et valider sa sortie d'académie. */
  evaluateTrainees: (u: SessionUser) =>
    u.isSuperAdmin || isDivisionChief(u, "TD") || canTrain(u),

  /** Délivrer ou révoquer un Firearm Security Certificate à un civil. */
  issueFirearmCertificate: (u: SessionUser) => hasCertification(u, "IFSC"),

  /** Statuer sur une demande de mutation vers une division. */
  decideTransfer: (u: SessionUser, divisionCode: string) =>
    u.isSuperAdmin || isCommandStaff(u) || isDivisionChief(u, divisionCode),

  /** Gérer les adhésions et communications syndicales. */
  manageUnion: (u: SessionUser) => u.isSuperAdmin || isUnionRepresentative(u),

  /** Consulter les statistiques départementales. */
  viewStatistics: (u: SessionUser) => isCommandStaff(u) || isDivisionChief(u),

  /**
   * Créer, modifier et supprimer les divisions/sous-unités/rôles internes, et
   * régler le grade minimum d'accès de chaque division. Command Staff seul.
   */
  manageDivisions: (u: SessionUser) => u.isSuperAdmin || isCommandStaff(u),

  /** Consulter le journal d'audit. */
  viewAuditLog: (u: SessionUser) =>
    u.isSuperAdmin || isCommandStaff(u) || inDivision(u, "IAD"),

  /**
   * Piloter l'ensemble du dispatch : créer et supprimer des patrouilles,
   * déplacer n'importe quel agent, changer le statut de n'importe quelle unité.
   *
   * Réservé au Watch Commander, à son adjoint et au commandement à partir du
   * grade de Lieutenant I. Tout autre agent ne déplace que sa propre carte.
   */
  manageDispatch: (u: SessionUser) =>
    u.isSuperAdmin ||
    hasCertification(u, "WATCH_COMMANDER") ||
    hasCertification(u, "ASSISTANT_WATCH_COMMANDER") ||
    atLeast(u, DISPATCH_COMMAND_LEVEL),
};

/**
 * Un agent peut-il déplacer la carte de `targetId` ?
 *
 * Seuls le Watch Commander, l'Assistant Watch Commander et le Command Staff
 * déplacent les cartes ; les autres agents n'en déplacent aucune.
 */
export const canMoveAgent = (u: SessionUser, _targetId: number) =>
  can.manageDispatch(u);

// ---------------------------------------------------------------------------
// Registre des modules — pilote le menu ET la protection des routes
// ---------------------------------------------------------------------------

export type ModuleKey =
  | "dashboard"
  | "academy"
  | "radio-codes"
  | "defcon"
  | "penal-code"
  | "procedures"
  | "reports"
  | "templates"
  | "civilians"
  | "warrants"
  | "evidence"
  | "complaints"
  | "lockers"
  | "dispatch"
  | "roster"
  | "announcements"
  | "messages"
  | "message-groups"
  | "transfers"
  | "convocations"
  | "firearm-certificates"
  | "union"
  | "internal-affairs"
  | "statistics"
  | "meetings"
  | "divisions"
  | "accounts"
  | "audit"
  | "mdt-management"
  // --- Espaces par division (Phase 1) ---
  | "metro-documents"
  | "metro-supervision"
  | "asd-documents"
  | "asd-supervision"
  | "iad-documents"
  | "iad-supervision"
  | "academy-documents"
  // --- Bureau des détectives (Phase 2) ---
  | "investigations"
  | "db-supervision"
  | "factions"
  // --- Académie (Phase 3) ---
  | "academy-supervision"
  | "academy-binomes";

export type ModuleGroup =
  | "Opérations terrain"
  | "Base de données"
  | "Ressources"
  | "Bureau des détectives"
  | "Metropolitan Division"
  | "Air Support Division"
  | "Internal Affairs Division"
  | "Académie de Police"
  | "Personnel"
  | "Command Staff";

export type ModuleDef = {
  key: ModuleKey;
  label: string;
  href: string;
  icon: string;
  group: ModuleGroup;
  canView: (u: SessionUser) => boolean;
};

export const MODULE_GROUPS: ModuleGroup[] = [
  "Opérations terrain",
  "Base de données",
  "Ressources",
  "Bureau des détectives",
  "Metropolitan Division",
  "Air Support Division",
  "Internal Affairs Division",
  "Académie de Police",
  "Personnel",
  "Command Staff",
];

/**
 * Un module dont `canView` est faux n'apparaît PAS dans le menu — il n'est pas
 * simplement grisé. C'est l'exigence de cloisonnement des Rookies : ils ne
 * doivent pas même savoir que les autres modules existent.
 */
export const MODULES: ModuleDef[] = [
  // Rendu à part, au-dessus des groupes (cf. sidebar).
  {
    key: "dashboard",
    label: "Tableau de bord",
    href: "/dashboard",
    icon: "LayoutDashboard",
    group: "Opérations terrain",
    canView: () => true,
  },

  // --- Opérations terrain --------------------------------------------------
  {
    key: "dispatch",
    label: "Dispatch",
    href: "/dispatch",
    icon: "RadioTower",
    group: "Opérations terrain",
    canView: isSworn,
  },
  {
    key: "radio-codes",
    label: "Référentiel opérationnel",
    href: "/radio-codes",
    icon: "Radio",
    group: "Opérations terrain",
    // Lecture seule pour les Rookies ; masqué au DOJ, extérieur au LSPD.
    canView: (u) => !isDoj(u),
  },
  {
    key: "defcon",
    label: "DEFCON",
    href: "/defcon",
    icon: "ShieldAlert",
    group: "Opérations terrain",
    // État de préparation du département : pour tout le LSPD, pas le DOJ.
    canView: (u) => !isDoj(u),
  },

  // --- Base de donnée -------------------------------------------------
  {
    key: "civilians",
    label: "Casiers Judiciaires",
    href: "/casiers-judiciaires",
    icon: "Fingerprint",
    group: "Base de données",
    canView: isSworn,
  },
  {
    key: "reports",
    label: "Rapports",
    href: "/reports",
    icon: "FileText",
    group: "Base de données",
    canView: isSworn,
  },
  {
    key: "warrants",
    label: "Mandats & avis de recherche",
    href: "/warrants",
    icon: "Siren",
    group: "Base de données",
    // Agents assermentés, et le Department of Justice (mandats et avis de recherche).
    canView: (u) => isSworn(u) || isDoj(u),
  },
  {
    key: "firearm-certificates",
    label: "Certificats d'armes",
    href: "/firearm-certificates",
    icon: "ShieldCheck",
    group: "Base de données",
    canView: (u) => can.issueFirearmCertificate(u),
  },
  {
    key: "complaints",
    label: "Plaintes & dépositions",
    href: "/complaints",
    icon: "FileWarning",
    group: "Base de données",
    canView: isSworn,
  },
  {
    key: "lockers",
    label: "Casiers",
    href: "/lockers",
    icon: "Lock",
    group: "Base de données",
    canView: isSworn,
  },
  {
    key: "evidence",
    label: "Preuves",
    href: "/evidence",
    icon: "FolderLock",
    group: "Base de données",
    canView: (u) => canUseEvidence(u),
  },

  // --- Ressources ----------------------------------------------------------
  {
    key: "penal-code",
    label: "Code pénal",
    href: "/penal-code",
    icon: "Scale",
    group: "Ressources",
    /**
     * Référentiel juridique de l'État de San Andreas.
     *
     * Ouvert à tout le personnel : rédiger un rapport, qualifier des faits ou
     * réviser à l'académie suppose d'y avoir accès. Les porteurs de
     * l'accréditation Department of Justice y accèdent donc aussi, et leur
     * accréditation est signalée en tête de module.
     */
    canView: () => true,
  },
  {
    key: "procedures",
    label: "Fiches circulaires",
    href: "/procedures",
    icon: "BookOpen",
    group: "Ressources",
    // À connaître de tous, Rookies compris ; masqué au DOJ.
    canView: (u) => !isDoj(u),
  },
  {
    key: "templates",
    label: "Templates de rapports",
    href: "/templates",
    icon: "LayoutTemplate",
    group: "Ressources",
    canView: (u) => can.manageTemplates(u),
  },

  // --- Bureau des détectives ----------------------------------------------
  {
    key: "investigations",
    label: "Enquêtes",
    href: "/investigations",
    icon: "Fingerprint",
    group: "Bureau des détectives",
    canView: (u) => canAccessInvestigations(u),
  },
  {
    key: "factions",
    label: "Groupuscules",
    href: "/factions",
    icon: "Skull",
    group: "Bureau des détectives",
    canView: (u) => canAccessInvestigations(u),
  },
  {
    key: "db-supervision",
    label: "Supervision du bureau",
    href: "/divisions/DB/supervision",
    icon: "UserSearch",
    group: "Bureau des détectives",
    canView: (u) => canSuperviseDivisionSpace(u, "DB"),
  },

  // --- Metropolitan Division ----------------------------------------------
  {
    key: "metro-documents",
    label: "Documents",
    href: "/divisions/METRO/documents",
    icon: "FileStack",
    group: "Metropolitan Division",
    canView: (u) => canViewDivisionSpace(u, "METRO"),
  },
  {
    key: "metro-supervision",
    label: "Supervision de la division",
    href: "/divisions/METRO/supervision",
    icon: "UserSearch",
    group: "Metropolitan Division",
    canView: (u) => canSuperviseDivisionSpace(u, "METRO"),
  },

  // --- Air Support Division ------------------------------------------------
  {
    key: "asd-documents",
    label: "Documents",
    href: "/divisions/ASD/documents",
    icon: "FileStack",
    group: "Air Support Division",
    canView: (u) => canViewDivisionSpace(u, "ASD"),
  },
  {
    key: "asd-supervision",
    label: "Supervision de la division",
    href: "/divisions/ASD/supervision",
    icon: "UserSearch",
    group: "Air Support Division",
    canView: (u) => canSuperviseDivisionSpace(u, "ASD"),
  },

  // --- Internal Affairs Division ------------------------------------------
  {
    key: "internal-affairs",
    label: "Affaires internes",
    href: "/internal-affairs",
    icon: "Scale",
    group: "Internal Affairs Division",
    canView: (u) => can.viewIaCases(u),
  },
  {
    key: "iad-documents",
    label: "Documents",
    href: "/divisions/IAD/documents",
    icon: "FileStack",
    group: "Internal Affairs Division",
    canView: (u) => canViewDivisionSpace(u, "IAD"),
  },
  {
    key: "iad-supervision",
    label: "Supervision de la division",
    href: "/divisions/IAD/supervision",
    icon: "UserSearch",
    group: "Internal Affairs Division",
    canView: (u) => canSuperviseDivisionSpace(u, "IAD"),
  },

  // --- Académie de Police --------------------------------------------------
  {
    key: "academy",
    label: "Planning académique",
    href: "/academy",
    icon: "GraduationCap",
    group: "Académie de Police",
    canView: (u) =>
      isAcademyTrainee(u) || can.manageAcademy(u) || isCommandStaff(u),
  },
  {
    key: "academy-documents",
    label: "Documents",
    href: "/academy/documents",
    icon: "FileStack",
    group: "Académie de Police",
    canView: (u) => canViewAcademyDocs(u),
  },
  {
    key: "academy-supervision",
    label: "Supervision de l'académie",
    href: "/academy/supervision",
    icon: "UserSearch",
    group: "Académie de Police",
    canView: (u) => canSuperviseAcademy(u),
  },
  {
    key: "academy-binomes",
    label: "Binômes",
    href: "/academy/binomes",
    icon: "UsersRound",
    group: "Académie de Police",
    canView: (u) => canViewBinomes(u),
  },

  // --- Personnel -----------------------------------------------------------
  {
    key: "roster",
    label: "Effectifs",
    href: "/roster",
    icon: "ClipboardList",
    group: "Personnel",
    canView: isSworn,
  },
  {
    key: "divisions",
    label: "Divisions",
    href: "/divisions",
    icon: "Network",
    group: "Personnel",
    canView: (u) => can.manageDivisions(u),
  },
  {
    key: "transfers",
    label: "Mutations",
    href: "/transfers",
    icon: "ArrowLeftRight",
    group: "Personnel",
    canView: isSworn,
  },
  {
    key: "announcements",
    label: "Annonces",
    href: "/announcements",
    icon: "Megaphone",
    group: "Personnel",
    canView: isSworn,
  },
  {
    key: "messages",
    label: "Messagerie",
    href: "/messages",
    icon: "Mail",
    group: "Personnel",
    canView: isSworn,
  },
  {
    key: "message-groups",
    label: "Groupes de messages",
    href: "/message-groups",
    icon: "MessagesSquare",
    group: "Personnel",
    // Tout agent assermenté relève au moins du canal Station 9.
    canView: isSworn,
  },
  {
    key: "convocations",
    label: "Convocations",
    href: "/convocations",
    icon: "CalendarClock",
    group: "Personnel",
    canView: (u) => canConvene(u),
  },
  {
    key: "union",
    label: "Syndicat",
    href: "/union",
    icon: "Handshake",
    group: "Personnel",
    canView: (u) => isSworn(u) && (u.unionRole !== null || u.isSuperAdmin),
  },

  // --- Command Staff -------------------------------------------------------
  {
    key: "meetings",
    label: "Réunions hebdomadaires",
    href: "/meetings",
    icon: "CalendarCheck",
    group: "Command Staff",
    canView: (u) => canManageMeetings(u),
  },
  {
    key: "statistics",
    label: "Statistiques",
    href: "/statistics",
    icon: "ChartColumn",
    group: "Command Staff",
    canView: (u) => can.viewStatistics(u),
  },
  {
    key: "accounts",
    label: "Gestion des comptes",
    href: "/accounts",
    icon: "UserCog",
    group: "Command Staff",
    canView: (u) => can.createAccount(u),
  },
  {
    key: "audit",
    label: "Journal d'audit",
    href: "/audit",
    icon: "ScrollText",
    group: "Command Staff",
    canView: (u) => can.viewAuditLog(u),
  },
  {
    key: "mdt-management",
    label: "Gestion MDT",
    href: "/mdt-management",
    icon: "DatabaseZap",
    group: "Command Staff",
    // Réinitialisation des données opérationnelles : Chief of Police seul.
    canView: (u) => isDepartmentHead(u),
  },
];

export const visibleModules = (u: SessionUser) =>
  MODULES.filter((m) => m.canView(u));

/** Entrée de menu sérialisable — un `ModuleDef` contient une fonction. */
export type NavItem = Omit<ModuleDef, "canView">;

/**
 * Menu prêt à être transmis à un composant client.
 * `canView` est retiré : une fonction ne peut pas franchir la frontière
 * serveur → client, et le filtrage a de toute façon déjà eu lieu ici.
 */
export const navItemsFor = (u: SessionUser): NavItem[] =>
  visibleModules(u).map(({ key, label, href, icon, group }) => ({
    key,
    label,
    href,
    icon,
    group,
  }));

export const canViewModule = (u: SessionUser, key: ModuleKey) =>
  MODULES.find((m) => m.key === key)?.canView(u) ?? false;

// ---------------------------------------------------------------------------
// Divers
// ---------------------------------------------------------------------------

/** Ancienneté en années pleines, affichée sur le profil public. */
export function yearsOfService(recruitedAt: Date, now = new Date()) {
  let years = now.getFullYear() - recruitedAt.getFullYear();
  const monthDelta = now.getMonth() - recruitedAt.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < recruitedAt.getDate())) {
    years--;
  }
  return Math.max(0, years);
}
