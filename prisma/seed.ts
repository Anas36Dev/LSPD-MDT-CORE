/**
 * Seed initial du MDT — grades, divisions, rôles internes, certifications,
 * médailles, codes radio, code pénal, templates de rapports et comptes de départ.
 *
 * Idempotent : conçu pour pouvoir être relancé sans dupliquer les données.
 *   npx prisma db seed
 */
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hash } from "@node-rs/argon2";

import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

// ---------------------------------------------------------------------------
// Grades
// ---------------------------------------------------------------------------

// L'ORDRE de ce tableau fixe l'ordre d'AFFICHAGE (champ `order`), qui entrelace
// Detective et Sergeant conformément à la hiérarchie protocolaire du
// département. Le champ `level`, lui, régit l'AUTORITÉ pour les permissions et
// reste strictement décroissant sans entrelacement — les deux sont distincts.
const RANKS = [
  { code: "CHIEF_OF_POLICE", name: "Chief of Police", level: 100, category: "CHIEF_OFFICE" },
  { code: "ASSISTANT_CHIEF", name: "Assistant Chief", level: 95, category: "CHIEF_OFFICE" },
  { code: "DEPUTY_CHIEF", name: "Deputy Chief", level: 90, category: "CHIEF_OFFICE" },
  { code: "COMMANDER", name: "Commander", level: 85, category: "COMMAND_STAFF" },
  { code: "CAPTAIN_III", name: "Captain III", level: 80, category: "COMMAND_STAFF" },
  { code: "CAPTAIN_II", name: "Captain II", level: 79, category: "COMMAND_STAFF" },
  { code: "CAPTAIN_I", name: "Captain I", level: 78, category: "COMMAND_STAFF" },
  { code: "LIEUTENANT_II", name: "Lieutenant II", level: 70, category: "COMMAND_STAFF" },
  { code: "LIEUTENANT_I", name: "Lieutenant I", level: 69, category: "COMMAND_STAFF" },
  { code: "DETECTIVE_III", name: "Detective III", level: 55, category: "DETECTIVE_STAFF" },
  { code: "SERGEANT_II", name: "Sergeant II", level: 60, category: "SUPERVISOR_STAFF" },
  { code: "DETECTIVE_II", name: "Detective II", level: 54, category: "DETECTIVE_STAFF" },
  { code: "SERGEANT_I", name: "Sergeant I", level: 59, category: "SUPERVISOR_STAFF" },
  { code: "DETECTIVE_I", name: "Detective I", level: 53, category: "DETECTIVE_STAFF" },
  { code: "POLICE_OFFICER_III_1", name: "Police Officer III+1", level: 40, category: "EXECUTIVE_STAFF" },
  { code: "POLICE_OFFICER_III", name: "Police Officer III", level: 39, category: "EXECUTIVE_STAFF" },
  { code: "POLICE_OFFICER_II", name: "Police Officer II", level: 38, category: "EXECUTIVE_STAFF" },
  { code: "POLICE_OFFICER_I", name: "Police Officer I", level: 37, category: "PROBATIONARY" },
  // Seul grade d'entrée effectivement utilisé par le département.
  { code: "ROOKIE", name: "Rookie", level: 10, category: "ACADEMY" },
  // Personnel du Department of Justice : grade à part, sous le Rookie. Ce n'est
  // pas un agent du LSPD ; il accède au code pénal, pas aux opérations.
  { code: "DOJ", name: "Department of Justice", level: 1, category: "DOJ" },
];

// ---------------------------------------------------------------------------
// Divisions, sous-unités et rôles internes
// ---------------------------------------------------------------------------

type DivisionSpec = {
  code: string;
  name: string;
  shortName: string;
  isRestricted: boolean;
  /** Grade minimum d'accès (level). 37 = Officer I, 38 = Officer II (défaut). */
  minRankLevel?: number;
  subDivisions: { code: string; name: string }[];
  roles: {
    code: string;
    name: string;
    isDivisionChief?: boolean;
    isUnitLead?: boolean;
    canTrain?: boolean;
    subDivision?: string;
  }[];
};

const DIVISIONS: DivisionSpec[] = [
  {
    code: "PATROL",
    name: "Patrol Division",
    shortName: "Patrol",
    isRestricted: false,
    minRankLevel: 37, // Patrol est accessible dès Police Officer I.
    subDivisions: [],
    roles: [],
  },
  {
    code: "METRO",
    name: "Metropolitan Division",
    shortName: "Metro",
    isRestricted: true,
    subDivisions: [
      { code: "METRO_B", name: "Platoon B — Gang & Criminal" },
      { code: "METRO_C", name: "Platoon C — Narcotics & Drug" },
      { code: "METRO_D", name: "Platoon D — SWAT" },
      { code: "METRO_K9", name: "Platoon K9" },
    ],
    roles: [
      { code: "METRO_CHIEF", name: "Chief of Metropolitan Division", isDivisionChief: true },
      { code: "METRO_INSTRUCTOR_B", name: "Instructor of Metropolitan Division — Platoon B", isUnitLead: true, canTrain: true, subDivision: "METRO_B" },
      { code: "METRO_INSTRUCTOR_C", name: "Instructor of Metropolitan Division — Platoon C", isUnitLead: true, canTrain: true, subDivision: "METRO_C" },
      { code: "METRO_INSTRUCTOR_D", name: "Instructor of Metropolitan Division — Platoon D", isUnitLead: true, canTrain: true, subDivision: "METRO_D" },
      { code: "METRO_INSTRUCTOR_K9", name: "Instructor of Metropolitan Division — Platoon K9", isUnitLead: true, canTrain: true, subDivision: "METRO_K9" },
      { code: "METRO_MEMBER", name: "Member of Metropolitan Division" },
    ],
  },
  {
    code: "ASD",
    name: "Air Support Division",
    shortName: "Air Support",
    isRestricted: false,
    subDivisions: [],
    roles: [
      { code: "ASD_CHIEF", name: "Chief of Air Support Division", isDivisionChief: true },
      { code: "ASD_INSTRUCTOR", name: "Instructor of Air Support Division", canTrain: true },
      { code: "ASD_MEMBER", name: "Member of Air Support Division" },
    ],
  },
  {
    code: "TD",
    name: "Training Division",
    shortName: "Training",
    isRestricted: false,
    subDivisions: [
      { code: "TD_IST", name: "In-Service Training Division" },
      { code: "TD_RTS", name: "Recruit Training Section" },
    ],
    roles: [
      { code: "TD_CHIEF", name: "Chief of Training Division", isDivisionChief: true, canTrain: true },
      { code: "TD_FTO", name: "Field Training Officer", canTrain: true, subDivision: "TD_IST" },
      { code: "TD_ACADEMY_INSTRUCTOR", name: "Instructor of Academy", canTrain: true, subDivision: "TD_RTS" },
    ],
  },
  {
    code: "IAD",
    name: "Internal Affairs Division",
    shortName: "Internal Affairs",
    isRestricted: true,
    subDivisions: [],
    roles: [
      { code: "IAD_CHIEF", name: "Chief of Internal Affairs Division", isDivisionChief: true },
      { code: "IAD_INSPECTOR", name: "Inspecteur des Affaires Internes" },
    ],
  },
  {
    code: "PCG",
    name: "Public Communication Group",
    shortName: "Public Comms",
    isRestricted: false,
    subDivisions: [],
    roles: [
      { code: "PCG_CHIEF", name: "Chief of Public Communication Group", isDivisionChief: true },
      { code: "PCG_MEMBER", name: "Member of Public Communication Group" },
    ],
  },
  {
    code: "DB",
    name: "Detective Bureau",
    shortName: "Detectives",
    isRestricted: false,
    subDivisions: [],
    roles: [
      { code: "DB_SUPERVISOR", name: "Detective Supervisor", isDivisionChief: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// Certifications transverses
// ---------------------------------------------------------------------------

const CERTIFICATIONS = [
  { code: "CCW1_GLOCK", name: "CCW 1 — Glock", category: "PPA", level: 1, description: "Habilitation au port et à l'usage du pistolet de service Glock." },
  { code: "CCW2_MP5", name: "CCW 2 — MP5", category: "PPA", level: 2, description: "Habilitation au pistolet-mitrailleur MP5." },
  { code: "CCW2_BEANBAG", name: "CCW 2 — Bean Bag", category: "PPA", level: 2, description: "Habilitation à l'arme à létalité réduite Bean Bag." },
  { code: "CCW2_REMINGTON", name: "CCW 2 — Remington", category: "PPA", level: 2, description: "Habilitation au fusil à pompe Remington." },
  { code: "CCW3_M4A1", name: "CCW 3 — M4A1", category: "PPA", level: 3, description: "Habilitation au fusil d'assaut M4A1." },
  { code: "LINCOLN_PATROL", name: "Lincoln Patrol", category: "PATROL", level: null, description: "Certification de patrouille Lincoln." },
  { code: "IFSC", name: "Instructor Firearm Security Certificate", category: "INSTRUCTOR", level: null, description: "Habilite à délivrer et révoquer le Firearm Security Certificate des civils." },
  { code: "WATCH_COMMANDER", name: "Watch Commander", category: "ACCREDITATION", level: null, description: "Responsable du dispatch. Constitue les patrouilles et affecte l'ensemble des agents en service." },
  { code: "ASSISTANT_WATCH_COMMANDER", name: "Assistant Watch Commander", category: "ACCREDITATION", level: null, description: "Seconde le Watch Commander. Mêmes prérogatives sur le dispatch et les patrouilles." },
];

// ---------------------------------------------------------------------------
// Médailles
// ---------------------------------------------------------------------------

// Les cinq décorations réellement décernées par le département.
const MEDALS = [
  { code: "MOH", name: "Medal of Honor", icon: "Award", color: "#d4af37", description: "Plus haute distinction du département, pour un acte de bravoure exceptionnel au péril de sa vie." },
  { code: "DSM", name: "Distinguished Service Medal", icon: "BadgeCheck", color: "#1f4f8f", description: "Contribution majeure et durable au fonctionnement du département." },
  { code: "MSM", name: "Meritorious Service Medal", icon: "ShieldCheck", color: "#2f6fb5", description: "Service exemplaire et constant sur une longue période." },
  { code: "ESM", name: "Exemplary Service Medal", icon: "Medal", color: "#3f8f5f", description: "Conduite exemplaire dans l'exercice des fonctions." },
  { code: "PS", name: "Police Star", icon: "Star", color: "#c0c0c0", description: "Bravoure remarquable face à un danger avéré." },
];

// Épreuves de l'examen de sortie d'académie. Admission à 80 %.
const ACADEMY_EXAM_SUBJECTS = [
  { code: "UNIVERSITAIRE", name: "Universitaire", maxPoints: 15 },
  { code: "CONDUITE", name: "Conduite", maxPoints: 15 },
  { code: "ARMES_A_FEU", name: "Formations aux armes à feu", maxPoints: 15 },
  { code: "RELATIONS_HUMAINES", name: "Relations humaines", maxPoints: 10 },
  { code: "LOIS", name: "Lois", maxPoints: 15 },
  { code: "TACTIQUES", name: "Tactiques", maxPoints: 15 },
  { code: "FORMATIONS_LSPD", name: "Formations spécifiques au LSPD", maxPoints: 15 },
];

/** Seuil d'admission à l'académie, en pourcentage. */
export const ACADEMY_PASS_THRESHOLD = 80;

// ---------------------------------------------------------------------------
// Codes radio
// ---------------------------------------------------------------------------

// Transcription fidèle du référentiel officiel du département
// (« Codes, call sign, droits Miranda, armes & alphabet »).
const RADIO_CODES = [
  // --- Codes radio ---------------------------------------------------------
  { category: "TEN_CODE", code: "10-01", label: "Mauvaise réception radio" },
  { category: "TEN_CODE", code: "10-03", label: "Silence radio" },
  { category: "TEN_CODE", code: "10-04", label: "Affirmatif" },
  { category: "TEN_CODE", code: "10-05", label: "Négatif" },
  { category: "TEN_CODE", code: "10-06", label: "Occupé" },
  { category: "TEN_CODE", code: "10-07", label: "Prise de service" },
  { category: "TEN_CODE", code: "10-08", label: "Fin de service" },
  { category: "TEN_CODE", code: "10-09", label: "Répétez" },
  { category: "TEN_CODE", code: "10-10", label: "Pause de service" },
  { category: "TEN_CODE", code: "10-11", label: "Reprise de service après un 10-10" },
  { category: "TEN_CODE", code: "10-12", label: "Stand-by" },
  { category: "TEN_CODE", code: "10-14", label: "Escorte en cours" },
  { category: "TEN_CODE", code: "10-15", label: "Suspect arrêté" },
  { category: "TEN_CODE", code: "10-18", label: "Salle de briefing" },
  { category: "TEN_CODE", code: "10-19", label: "En direction vers un lieu spécifique" },
  { category: "TEN_CODE", code: "10-20", label: "Demande de position (Code 2)" },
  { category: "TEN_CODE", code: "10-23", label: "Arrivé sur les lieux" },
  { category: "TEN_CODE", code: "10-24", label: "Renfort demandé" },
  { category: "TEN_CODE", code: "10-30", label: "Bagarre de rue" },
  { category: "TEN_CODE", code: "10-31", label: "Poursuite en cours" },
  { category: "TEN_CODE", code: "10-32", label: "Suspect armé" },
  { category: "TEN_CODE", code: "10-33", label: "Braquage de train" },
  { category: "TEN_CODE", code: "10-34", label: "Tir d'arme à feu" },
  { category: "TEN_CODE", code: "10-36", label: "Braquage de supérette" },
  { category: "TEN_CODE", code: "10-37", label: "Véhicule suspect" },
  { category: "TEN_CODE", code: "10-38", label: "Braquage de banque" },
  { category: "TEN_CODE", code: "10-41", label: "Début de patrouille" },
  { category: "TEN_CODE", code: "10-42", label: "Fin de patrouille" },
  { category: "TEN_CODE", code: "10-46", label: "Vol de véhicule" },
  { category: "TEN_CODE", code: "10-47", label: "Vente de drogue" },
  { category: "TEN_CODE", code: "10-48", label: "Contrôle de véhicule" },
  { category: "TEN_CODE", code: "10-50", label: "Accident de la route" },
  { category: "TEN_CODE", code: "10-52", label: "Demande d'EMS" },
  { category: "TEN_CODE", code: "10-53", label: "Demande de dépanneuse" },
  { category: "TEN_CODE", code: "10-55", label: "Braquage de bijouterie" },
  { category: "TEN_CODE", code: "10-60", label: "Prise d'otage sur civil" },
  { category: "TEN_CODE", code: "10-99", label: "Officier en danger, besoin de renfort" },

  // --- Codes de patrouille -------------------------------------------------
  { category: "PATROL_CODE", code: "Code 1", label: "Aucun gyrophare, ni sirène" },
  { category: "PATROL_CODE", code: "Code 2", label: "Gyrophare seulement" },
  { category: "PATROL_CODE", code: "Code 3", label: "Gyrophare et sirène" },
  { category: "PATROL_CODE", code: "Code 4", label: "Fin d'intervention" },
  { category: "PATROL_CODE", code: "Code 6", label: "Surveillance de zone" },
  { category: "PATROL_CODE", code: "Code 99", label: "Officier en danger, besoin de renfort" },

  // --- Call signs ----------------------------------------------------------
  { category: "CALL_SIGN", code: "Lincoln", label: "Patrouille à 1 effectif" },
  { category: "CALL_SIGN", code: "Adam", label: "Patrouille à 2 effectifs" },
  { category: "CALL_SIGN", code: "Tango", label: "Patrouille à 3 effectifs" },
  { category: "CALL_SIGN", code: "X-Ray", label: "Patrouille à 4 effectifs" },
  { category: "CALL_SIGN", code: "Bertrand", label: "Patrouille nautique" },
  { category: "CALL_SIGN", code: "Henry", label: "Patrouille aérienne" },
  { category: "CALL_SIGN", code: "Mary", label: "Patrouille motorisée" },
  { category: "CALL_SIGN", code: "Victor", label: "Patrouille cycliste" },
  { category: "CALL_SIGN", code: "Sierra", label: "Patrouille en véhicule rapide d'intervention" },
  { category: "CALL_SIGN", code: "David", label: "Metropolitan Division (SWAT)" },
  { category: "CALL_SIGN", code: "K9", label: "Metropolitan Division (K-9)" },
  { category: "CALL_SIGN", code: "Goliath", label: "Metropolitan Division (Gang & Narcotic)" },
  { category: "CALL_SIGN", code: "India", label: "Detective Bureau" },

  // --- Catégories d'armement -----------------------------------------------
  { category: "WEAPON_CATEGORY", code: "A", label: "Armes blanches" },
  { category: "WEAPON_CATEGORY", code: "B", label: "Armes de poing" },
  { category: "WEAPON_CATEGORY", code: "C", label: "Armes automatiques légères" },
  { category: "WEAPON_CATEGORY", code: "D", label: "Fusils" },
  { category: "WEAPON_CATEGORY", code: "E", label: "Fusil d'assaut" },
  { category: "WEAPON_CATEGORY", code: "F", label: "Armes lourdes" },
  { category: "WEAPON_CATEGORY", code: "G", label: "Armes de précision" },
  { category: "WEAPON_CATEGORY", code: "H", label: "Explosifs" },

  // --- DEFCON --------------------------------------------------------------
  { category: "DEFCON", code: "5", label: "Préparation normale" },
  { category: "DEFCON", code: "4", label: "Préparation normale, renseignements accrus et mesures de sécurités renforcées" },
  { category: "DEFCON", code: "3", label: "Accroissement de la préparation des forces, prêt à être mobilisé en 15 minutes" },
  { category: "DEFCON", code: "2", label: "Accroissement supplémentaire dans la préparation des forces, l'Armée est prête" },
  { category: "DEFCON", code: "1", label: "Préparation maximale des forces (état de guerre)" },

  // --- Alphabet phonétique de l'OTAN ---------------------------------------
  { category: "PHONETIC", code: "A", label: "Alpha" },
  { category: "PHONETIC", code: "B", label: "Bravo" },
  { category: "PHONETIC", code: "C", label: "Charlie" },
  { category: "PHONETIC", code: "D", label: "Delta" },
  { category: "PHONETIC", code: "E", label: "Echo" },
  { category: "PHONETIC", code: "F", label: "Foxtrot" },
  { category: "PHONETIC", code: "G", label: "Golf" },
  { category: "PHONETIC", code: "H", label: "Hotel" },
  { category: "PHONETIC", code: "I", label: "India" },
  { category: "PHONETIC", code: "J", label: "Juliet" },
  { category: "PHONETIC", code: "K", label: "Kilo" },
  { category: "PHONETIC", code: "L", label: "Lima" },
  { category: "PHONETIC", code: "M", label: "Mike" },
  { category: "PHONETIC", code: "N", label: "November" },
  { category: "PHONETIC", code: "O", label: "Oscar" },
  { category: "PHONETIC", code: "P", label: "Papa" },
  { category: "PHONETIC", code: "Q", label: "Québec" },
  { category: "PHONETIC", code: "R", label: "Roméo" },
  { category: "PHONETIC", code: "S", label: "Sierra" },
  { category: "PHONETIC", code: "T", label: "Tango" },
  { category: "PHONETIC", code: "U", label: "Uniform" },
  { category: "PHONETIC", code: "V", label: "Victor" },
  { category: "PHONETIC", code: "W", label: "Whisky" },
  { category: "PHONETIC", code: "X", label: "X-Ray" },
  { category: "PHONETIC", code: "Y", label: "Yankee" },
  { category: "PHONETIC", code: "Z", label: "Zulu" },
];

// Textes de référence — transcription fidèle du document officiel.
const REFERENCE_TEXTS = [
  {
    code: "MIRANDA",
    title: "Droits Miranda",
    category: "MIRANDA",
    content: [
      "Madame/Monsieur (X), nous sommes le (date), il est actuellement (heure), vous êtes placé en état d'arrestation pour les faits suivants (faits reprochés).",
      "",
      "Vous avez le droit de garder le silence, si vous renoncez à ce droit tout ce que vous direz pourra et sera utilisé contre vous devant une cour de justice. Vous avez le droit à un avocat et d'avoir un avocat présent lors de votre interrogatoire, si vous n'en avez pas les moyens, un avocat commis d'office vous sera fourni.",
      "",
      "Vous avez également le droit à un appel téléphonique, à boire, à manger et à des soins médicaux.",
      "",
      "Avez-vous bien compris les droits que je viens de vous citer ?",
    ].join("\n"),
    notes: [
      "Si NON : répéter jusqu'à 3 fois ses droits. Si OUI : « Souhaitez-vous exercer l'un de vos droits ? »",
      "",
      "Remarque : si vous devez répéter jusqu'à 3 fois ses droits, vous considérez qu'ils sont compris.",
      "",
      "Nota bene : dans le cas où l'individu réalise des aveux sans la lecture des droits Miranda, cela ne cause pas sa libération, mais cause l'annulation de ses aveux devant une cour de justice.",
    ].join("\n"),
  },
];


// Fiches circulaires du département, transcrites depuis les documents officiels
// signés par le Capitaine Juan REYEZ (Poste de police Mission Row).
const PROCEDURE_TEXTS = [
  {
    code: "ARRESTATION",
    title: "Fiche circulaire 1.2 — Arrestation",
    category: "CIRCULAIRE",
    content: [
      "Définition : une arrestation est le fait de priver un suspect de tout droit, dont celui de circuler.",
      "Elle n'est possible que si les faits entraînent une peine de prison ou un placement en détention provisoire ordonné par une cour de justice.",
      "",
      "ÉTAPES",
      "1. Le suspect est interpellé.",
      "2. Le suspect est maîtrisé et menotté s'il est dangereux pour lui-même ou pour autrui.",
      "3. Le suspect est fouillé : confiscation de tout élément dangereux ou illégal (armes à feu, armes blanches, drogues) ainsi que de ses moyens de communication. Les drogues doivent être vérifiées au laboratoire. Au-delà de 10 000 $ en liquide, l'argent peut être saisi pour test par un banquier.",
      "4. Contrôle des papiers (carte d'identité et carte d'activité) et photographie de ces documents. Sans papiers, un test ADN sera réalisé au poste.",
      "5. Lecture des droits Miranda — dans les 15 minutes suivant le menottage.",
      "6. Le suspect est sécurisé dans le véhicule de service et conduit au poste.",
      "",
      "ATTENTION : si le suspect est arrêté pour un braquage, ne pas ajouter le fait « Possession d'argent sale ».",
    ].join("\n"),
    notes:
      "La lecture des droits peut se faire sur place ou au poste, tant que le délai de 15 minutes après menottage est respecté. Il est préférable de la faire devant témoin.",
  },
  {
    code: "MISE_EN_CELLULE",
    title: "Fiche circulaire 1.2 — Mise en cellule",
    category: "CIRCULAIRE",
    content: [
      "EXIGENCES PERMANENTES",
      "Deux agents au minimum (sauf cas particulier). Le taser reste en main tant que le suspect n'est pas en cellule.",
      "",
      "PROCÉDURE",
      "1. Entrée par le parking à l'arrière du poste de police.",
      "2. Nouvelle fouille, pour s'assurer que le suspect ne s'est rien procuré entre-temps.",
      "3. Lecture des droits si elle n'a pas été faite. Au moindre doute, relire les droits.",
      "4. Dépôt des effets personnels dans un casier. Les lunettes de vue ne sont pas confisquées. Les médicaments sont conservés et donnés en cas de nécessité, sur présentation d'une ordonnance.",
      "5. Remise de la tenue de prisonnier et changement.",
      "6. Affectation d'une cellule et verrouillage de la porte.",
      "7. Sans papiers d'identité : prélèvement de salive au coton-tige, analyse au laboratoire (environ 1 minute), récupération du nom et vérification des avis de recherche.",
      "8. Substances suspectes : analyse au laboratoire (environ 1 minute), et en cas de résultat positif, ajout du fait de possession de drogues correspondant à la quantité.",
      "",
      "FIN DE PROCÉDURE",
      "Convoi fédéral si la peine est supérieure ou égale à 60 minutes, puis attente de la fin du convoi dans la prison fédérale.",
      "Soumission du casier judiciaire.",
    ].join("\n"),
    notes:
      "La détention fédérale a lieu au centre pénitencier de Blaine County à Bolingbroke, sur décision de justice ou en détention provisoire.",
  },
  {
    code: "GESTION_DROITS",
    title: "Fiche circulaire 1.2 — Gestion des droits du détenu",
    category: "CIRCULAIRE",
    content: [
      "Les droits sont accordés de préférence dans cet ordre. LA DEMANDE D'AVOCAT DOIT TOUJOURS ÊTRE LE DERNIER DROIT HONORÉ.",
      "",
      "1. BOIRE ET MANGER",
      "Demander impérativement au suspect s'il a des allergies ou intolérances, et adapter la nourriture. Ne jamais le laisser sans boire ni manger pendant la procédure : sa santé relève de votre responsabilité. Servir un aliment à un suspect ayant signalé une allergie constitue un vice de procédure.",
      "",
      "2. APPEL TÉLÉPHONIQUE",
      "Une salle est prévue à cet effet, sans restriction de durée dans la limite du raisonnable. Indiquer au suspect qu'aucun micro ni caméra n'est présent. Rester dans la pièce pendant l'appel constitue un vice de procédure.",
      "",
      "3. AVOCAT OU EMS",
      "Avant toute descente en cellule de l'intervenant : contrôler ses papiers, le fouiller et lui retirer armes et objets dangereux — mais jamais ses moyens de communication, outil de travail. Fouiller également la mallette de l'avocat. L'accompagner jusqu'au suspect, puis lui restituer ses effets à la sortie.",
      "Laisser l'avocat et son client en privé en salle d'interrogatoire, en précisant qu'aucun micro ni caméra n'y est présent. Écouter leur conversation constitue un vice de procédure.",
      "",
      "RÉDUCTIONS DE PEINE",
      "Avocat commis d'office : jusqu'à 15 % de la peine maximale.",
      "Avocat sous contrat : jusqu'à 50 % de la peine maximale — demander le contrat liant l'avocat au suspect.",
      "Toute réduction négociée par un avocat sur une peine supérieure à 10 minutes requiert l'accord d'un membre du Command Staff.",
      "L'agent peut de sa propre initiative réduire la peine de 10 minutes au maximum selon la coopération du suspect. Cette réduction se cumule avec celle de l'avocat.",
      "",
      "CALCUL DE LA PEINE",
      "Les amendes sont cumulables. Les peines de prison ne le sont PAS : c'est toujours la plus longue parmi les faits d'inculpation qui prime.",
    ].join("\n"),
    notes:
      "Exemple officiel : braquage de supérette et prise d'otage → 45 500 $ d'amendes et 60 minutes de prison.",
  },
  {
    code: "REGLEMENT",
    title: "Fiche circulaire 1.1 — Règlement",
    category: "CIRCULAIRE",
    content: [
      "1. Les agents de police ripoux ou infiltrés sont interdits.",
      "2. Interdiction d'appeler les EMS lors des fusillades policières tant que des menaces sont présentes.",
      "3. PIT autorisé uniquement avec un véhicule équipé d'un pare-buffle et sur autorisation d'un membre du Command Staff. Interdit sur les motos.",
      "4. Vous représentez notre ville : comportement et tenue irréprochables, y compris hors service.",
      "5. La parole d'un membre du LSPD est sous serment. Interdiction de mentir ; un fait constaté en flagrant délit ne se discute pas.",
      "6. Une fouille corporelle doit être justifiée : infraction commise, comportement agressif, proximité d'un point connu ou personne suspecte.",
      "7. À chaque arrestation, citer les droits Miranda dans les 15 minutes suivant le menottage.",
      "8. Respect des ordres et de la chaîne de grades.",
      "9. Radio claire et non polluée d'informations inutiles.",
      "10. Interdiction de récupérer de force la carte d'identité sans accord préalable ; au poste, le test ADN lève l'anonymat.",
      "11. Interdiction de chercher les points de récolte, de traitement et de vente de drogues.",
      "12. En cas d'accident, de véhicule abîmé ou de mise en fourrière, contacter le mécanicien ; à défaut, mise en fourrière.",
      "13. Interdiction de porter un couvre-chef autre que la casquette LSPD, et de teinter ses armes.",
      "14. Tenue de service LSPD obligatoire. Les tenues personnalisées sont totalement interdites sans accord du Watch Commander pour des missions, et sont uniquement réservées aux Détectives.",
      "15. Lecture et connaissance des notes de service obligatoires.",
      "16. Gilet pare-balles maîtrisé et rangé dans le coffre, prêt à être sorti. Hors DEFCON 3 minimum ou demande du Command Staff, aucun gilet visible en patrouille.",
      "17. Armes d'épaule dans le coffre du véhicule. Hors DEFCON 3 minimum ou demande du Command Staff, aucun agent équipé d'arme d'épaule en patrouille.",
    ].join("\n"),
    notes: null,
  },
  {
    code: "ARMEMENT_PAR_GRADE",
    title: "Fiche circulaire 1.1 — Armement autorisé par grade",
    category: "CIRCULAIRE",
    content: [
      "Chief Office : aucune restriction d'armement.",
      "Command Staff : Taser, Matraque, Glock, MP5 ou Remington.",
      "Sergeant II : Taser, Matraque, Glock, MP5 ou Remington.",
      "Sergeant I : Taser, Matraque, Glock, MP5 ou Remington.",
      "Police Officer III+1 : Taser, Matraque, Glock.",
      "Police Officer III : Taser, Matraque, Glock.",
      "Police Officer II : Taser, Matraque, Glock.",
      "Police Officer I : Taser, Matraque, Glock.",
      "Detective I, II et III : Glock uniquement.",
      "Rookie : aucune arme autorisée.",
      "",
      "STOCKAGE",
      "Les armes lourdes et légères (MP5, Remington, M4) doivent être déposées dans les coffres de véhicules en toute circonstance.",
      "En DEFCON 3 ou moins, les armes peuvent être gardées à proximité de la patrouille.",
      "Lors d'interventions, le SWAT peut utiliser les armes lourdes et doit les déposer la mission terminée.",
    ].join("\n"),
    notes: null,
  },
  {
    code: "DISCIPLINE_RADIO",
    title: "Fiche circulaire 1.1 — Discipline radio en opération",
    category: "CIRCULAIRE",
    content: [
      "Toute opération a un chef : le LEADER OPERATION (LEAD OP).",
      "Seuls deux rôles communiquent à la radio : le LEAD OP, et le NÉGOCIATEUR qui relaie les demandes des ravisseurs.",
      "Les agents en position ne transmettent que les éléments permettant au LEAD OP d'évaluer ou de réévaluer la situation.",
      "",
      "Le Code 99 (équivalent 10-99) n'est à utiliser qu'en cas d'extrême urgence : tir sur un agent, agent à terre, agent pris en otage. Tout usage abusif sera sanctionné.",
    ].join("\n"),
    notes:
      "Discipline attendue : clair, précis et concis. La courtoisie inutile pollue le réseau.",
  },
  {
    code: "NEGOCIATION",
    title: "Fiche circulaire 1.3 — Guide de négociation",
    category: "CIRCULAIRE",
    content: [
      "LE BUT DE LA NÉGOCIATION",
      "Le principal but d'une négociation est d'éviter de devoir agir avec la force. La mission du négociateur est d'obtenir la libération de l'otage sans qu'une intervention armée ne soit nécessaire, ce qui permet d'éviter toute blessure ou décès de part et d'autre.",
      "Second objectif : gagner du temps pour que le dispositif policier puisse se mettre en place dans les meilleures conditions. La négociation est parfois une simple diversion.",
      "",
      "L'ATTITUDE",
      "Le négociateur doit toujours garder son calme et rester le plus neutre possible, afin de faire oublier aux suspects que son objectif est également l'arrestation. Il doit les mettre en confiance et établir un dialogue.",
      "Il ne faut pas plier à chacune de leurs demandes sous prétexte qu'ils ont un otage. Ils doivent être conscients que si l'otage est blessé ou abattu, un assaut sera lancé et leur propre vie sera mise en péril.",
      "Ils doivent donc se montrer raisonnables dans leurs demandes et donner quelque chose en échange de ce qu'ils réclament : des otages, des garanties.",
      "",
      "DEMANDES SYSTÉMATIQUEMENT REFUSÉES — sécurité des agents",
      "1. Que les policiers se mettent en ligne les mains en l'air.",
      "2. Que les policiers ne soient pas armés si les braqueurs le sont.",
      "3. Que les policiers ne se mettent pas à couvert.",
      "Ces demandes sont jugées trop risquées : les braqueurs pourraient prendre en otage ou abattre les policiers sans que rien ne puisse les en empêcher.",
      "",
      "DEMANDES IRRECEVABLES — déontologie et vie de l'otage",
      "4. Ne pas suivre les braqueurs quand ils s'enfuient avec l'otage. Si l'on perd le visuel, rien ne les empêchera de le tuer ; seule notre présence garantit sa libération.",
      "5. Donner un véhicule de police, un hélicoptère ou tout autre moyen.",
      "6. Donner des armes, de la drogue ou des informations sur des civils, des agents ou des points de drogue.",
      "7. Libérer un terroriste.",
      "",
      "CONSEILS",
      "Demandez toujours quelque chose en échange de leur demande.",
      "Évitez de céder trop vite : plus vous résistez, plus vous pourrez demander en retour. Attention toutefois à ne pas paraître trop gourmand, sous peine de faire échouer la négociation.",
      "Vous pouvez concéder quelque chose gratuitement au début pour les mettre dans de bonnes dispositions.",
      "Coupez votre radio pendant la négociation, pour éviter que les suspects n'entendent les informations échangées.",
      "Prenez votre temps, ralentissez la cadence.",
      "",
      "RENSEIGNEMENTS À RECUEILLIR",
      "Profitez de la négociation pour recueillir un maximum d'informations sur les braqueurs et les otages :",
      "- nombre",
      "- armement",
      "- véhicules et plaques",
      "- noms et surnoms",
      "- intentions",
      "- itinéraire de fuite",
      "Si assez d'informations sont recueillies, une arrestation pourra se faire ultérieurement.",
      "",
      "POINTS D'ATTENTION",
      "Le négociateur ne dirige PAS l'opération : il doit demander l'autorisation du LEAD OP avant d'accepter toute revendication.",
      "Les herses doivent être enlevées en dernier, pour éviter une sortie surprise des braqueurs en cours de négociation.",
      "En l'absence d'un membre du Command Staff, évitez de donner de l'argent aux preneurs d'otages : il ne sera pas remboursé, sauf cas exceptionnel.",
    ].join("\n"),
    notes:
      "La sécurité des agents et des passants est absolue. Il n'est pas question de se mettre en danger de manière disproportionnée pour obtenir l'éventuelle libération d'un otage.",
  },
  {
    code: "ROLES_AGENTS",
    title: "Fiche circulaire 1.4 — Rôles des agents",
    category: "CIRCULAIRE",
    content: [
      "À chaque grade ses compétences. Il est attendu de plus en plus d'implication, de sérieux et de compétences en montant en grade.",
      "",
      "RECRUE ACADÉMIQUE",
      "",
      "ROOKIE",
      "Élève officier en formation à la Police Academy. Il suit l'instruction complète — lois, procédures, tactique, conduite, tir et relations humaines — et doit valider l'intégralité de son cursus ainsi que sa candidature avant d'être assermenté au grade de Police Officer I.",
      "",
      "EXECUTIVE STAFF",
      "",
      "POLICE OFFICER I",
      "Officier de police en période probatoire. Fraîchement assermenté, il patrouille sous la supervision étroite d'un Field Training Officer et doit faire ses preuves ; toute faute grave peut mettre fin à sa probation (15 jours).",
      "",
      "POLICE OFFICER II",
      "Officier confirmé ayant achevé sa probation. Il assure de façon autonome l'ensemble des missions de patrouille et peut se voir confier l'encadrement d'un Police Officer I.",
      "Débloque : la candidature à toutes les divisions — Metropolitan Division, Air Support Division, Internal Affairs Division, Training Division et Detective Bureau (grade minimum d'accès : Police Officer II).",
      "",
      "POLICE OFFICER III",
      "Officier expérimenté qualifié Field Training Officer (FTO). Il forme et évalue les officiers en probation sur le terrain, sert de référent procédural et rend compte de leur progression. Rédige un rapport hebdomadaire : bilan d'activité, agents avec qui il a patrouillé et état des effectifs.",
      "",
      "POLICE OFFICER III+1",
      "Police Officer III affecté comme Senior Lead Officer : officier référent d'un secteur, il coordonne la police de proximité, encadre les officiers de sa zone et vérifie la conformité des procédures et des interpellations de ses subordonnés.",
      "Débloque : la Police Academy, en tant que recruteur ou formateur.",
      "",
      "DETECTIVE STAFF",
      "",
      "DETECTIVE I",
      "Enquêteur de premier échelon. Il instruit les affaires qui lui sont confiées — recueil des preuves, auditions, surveillances — sous la supervision d'un détective plus gradé.",
      "",
      "DETECTIVE II",
      "Détective confirmé. Il prend en charge les affaires complexes, coordonne certaines investigations et sert de référent technique d'enquête. Peut encadrer des Detective I.",
      "",
      "DETECTIVE III",
      "Detective Supervisor. Il dirige une brigade de détectives, répartit les affaires, contrôle la qualité des enquêtes et encadre l'ensemble des détectives du Detective Bureau.",
      "",
      "SUPERVISOR STAFF",
      "",
      "SERGEANT I",
      "Superviseur de terrain de premier niveau. Il encadre directement les officiers en patrouille, intervient sur les situations délicates, contrôle la conformité des procédures et des rapports et fait remonter les problèmes de terrain. Peut tenir le rôle d'Assistant Watch Commander et assure le dispatch en l'absence de l'état-major.",
      "Débloque : être formateur de toutes les divisions.",
      "",
      "SERGEANT II",
      "Sergent principal et Watch Commander du service. Il commande la vacation en cours, supervise le travail des unités et des divisions, organise les réunions de supervision, gère l'affectation du personnel et peut prononcer des sanctions. Peut également tenir le rôle d'Assistant Watch Commander.",
      "Débloque : être directeur de division.",
      "",
      "COMMAND STAFF",
      "",
      "LIEUTENANT I",
      "Lieutenant de commandement. Il supervise le corps des sergents, garantit le temps de réponse et l'efficacité du poste, dirige l'organisation des dispatch et participe aux décisions du poste. Applique blâmes, mises à pied et licenciements, sous réserve de ses supérieurs.",
      "Débloque : convoquer un 10-18 général, procéder à des recrutements.",
      "",
      "LIEUTENANT II",
      "Lieutenant principal et Officer in Charge. Il seconde le capitaine dans le commandement du poste, gère les fonctions administratives — planning, personnel, promotions et rétrogradations — et assure les relations avec les partenaires extérieurs. Peut licencier sans l'accord du capitaine.",
      "",
      "CAPTAIN I, II ET III",
      "Officier commandant d'un poste de police. Le Captain III commande le poste, secondé par les Captain II et I. Responsable de l'ensemble du personnel, des opérations et de la discipline ; ses décisions ne peuvent être annulées que par le Commander ou le Chief Office. Applique toutes les sanctions administratives officielles : blâmes, mises à pied, licenciements et sanctions disciplinaires.",
      "",
      "COMMANDER",
      "Officier d'état-major du LSPD supervisant plusieurs postes et divisions. Il coordonne les opérations à l'échelle du service, appuie les capitaines et veille à l'application uniforme des procédures. Ses décisions font force de loi et il applique les sanctions officielles.",
      "",
      "CHIEF OFFICE",
      "",
      "DEPUTY CHIEF",
      "Commande un bureau du LSPD regroupant plusieurs divisions ou unités. Il traduit les orientations du Chief Office en directives opérationnelles et entretient les relations de travail avec l'encadrement, le personnel et les autres services de la collectivité. Rend compte à l'Assistant Chief.",
      "",
      "ASSISTANT CHIEF",
      "Plus haut gradé sous le Chief of Police. Il dirige les opérations du service : supervise l'ensemble des divisions, des bureaux et des dispositifs de patrouille d'envergure, rend compte directement au Chief et peut traiter toute question soulevée par l'encadrement supérieur.",
      "",
      "CHIEF OF POLICE",
      "Directeur du service et autorité suprême du LSPD. Il définit la politique, la doctrine et l'organisation du département, nomme l'état-major, les directeurs de divisions et les superviseurs, et répond du service devant les autorités civiles.",
    ].join("\n"),
    notes: null,
  },
  {
    code: "BRAQUAGE",
    title: "Fiche circulaire 1.5 — Braquage",
    category: "CIRCULAIRE",
    content: [
      "PHASE 1 — ARRIVÉE ET PÉRIMÈTRE",
      "",
      "a. Arrivée sur les lieux. La première patrouille arrivée a pour mission d'observer l'environnement et de le décrire brièvement aux unités non présentes :",
      "- le nombre de suspects et la présence d'otages, si possible",
      "- les véhicules présents",
      "- toute autre information utile",
      "Ces observations se font rapidement, d'un simple coup d'œil : pas besoin de fouiller la zone à ce stade.",
      "",
      "b. Mise en place du périmètre de sécurité. Une fois la zone observée et les informations transmises à la radio, les premières unités installent le périmètre pour éviter que des civils n'interfèrent ou ne soient pris à partie.",
      "Barrières et herses sont disposées sur tous les accès menant à la zone d'opération, trottoirs compris. Le périmètre est surveillé par tous les agents présents, qui interdisent le passage aux civils.",
      "Inutile de faire un périmètre de plusieurs centaines de mètres : il faut conserver un visuel constant sur tous les agents.",
      "DOTATION : cinq barrières et deux herses par véhicule.",
      "",
      "PHASE 2 — COMMANDEMENT ET PLAN D'ACTION",
      "",
      "Une fois la zone sécurisée, LE PLUS HAUT GRADÉ PRÉSENT PREND EN CHARGE L'OPÉRATION (LEAD OP). Il est le seul à décider et ses ordres doivent être suivis à la lettre. Les autres unités restent en stand-by, tenant le périmètre ou se tenant prêtes devant la zone ciblée.",
      "",
      "a. Prise de contact. Le LEAD OP désigne un négociateur — volontaire ou membre de la Negociation Unit — pour entrer en contact avec les suspects. Idéalement quelqu'un d'autre que lui-même, afin qu'il reste disponible pour diriger l'ensemble du dispositif.",
      "",
      "b. Plan d'action. Le LEAD OP établit un plan : négociation, intervention, ou autre. Il est invité à consulter plusieurs avis avant de le confirmer, mais il a toujours le dernier mot. Le plan est ensuite communiqué à la radio afin que chacun sache ce qui doit être fait.",
      "",
      "c. Exécution. Une fois le plan lancé, il faut s'y tenir et respecter les consignes. S'il faut souvent s'adapter aux imprévus, nul ne doit en faire à sa tête ni abandonner le plan sans ordre explicite.",
      "",
      "PHASE 3 — APRÈS L'OPÉRATION",
      "",
      "a. Rangement de la zone. Toutes les barrières, herses et véhicules doivent être rangés avant le retour au poste. Il n'est pas acceptable de laisser de l'équipement de police — ou des suspects — sur les lieux. N'hésitez pas à appeler les dépanneurs et les EMS.",
      "",
      "b. Gestion des otages. Le LEAD OP aura désigné, avant le début de l'opération, un équipage chargé des otages. Dès leur prise en charge :",
      "1. Demander comment il va.",
      "2. Demander une pièce d'identité.",
      "3. Fouiller l'otage.",
      "4. Demander s'il a des informations sur les ravisseurs : surnom, nom, nom de gang.",
      "5. Demander s'il souhaite déposer plainte.",
      "6. Demander s'il souhaite être déposé quelque part ou s'il prend un taxi.",
      "",
      "c. Course-poursuite. Dans 95 % des cas, le braquage se termine en course-poursuite (10-31) :",
      "- La patrouille chargée des otages reste sur les lieux et ne rejoint la poursuite qu'une fois cette gestion terminée.",
      "- Pas plus de deux ADAM en poursuite. Si une VIR est présente, elle prend la tête.",
      "- Le PIT est interdit.",
      "",
      "d. Arrestation. En cas d'arrestation à l'issue de la poursuite, appliquer la fiche circulaire 1.2 — Arrestation et mise en cellule.",
    ].join("\n"),
    notes: null,
  },
  {
    code: "AVOCATS",
    title: "Fiche circulaire 1.6 — Avocats et vices de procédure",
    category: "CIRCULAIRE",
    content: [
      "QU'EST-CE QU'UN VICE DE PROCÉDURE ?",
      "Il y a vice de procédure dès lors qu'au cours d'une procédure, il est porté atteinte aux droits de l'individu concerné : ses droits ne lui sont pas cités, ce qu'il a demandé ne lui est pas donné, et ainsi de suite.",
      "",
      "LES SEPT VICES DE PROCÉDURE",
      "",
      "1. NON-LECTURE DES DROITS MIRANDA",
      "Dès lors qu'un suspect est menotté, l'agent dispose de 15 minutes pour lui lire ses droits Miranda. Si l'individu n'a pas été menotté, aucun délai maximum ne s'applique.",
      "",
      "2. NON-RESPECT DES DROITS CITÉS",
      "Une fois les droits Miranda cités, si le suspect demande un droit, les agents sont dans l'obligation de le lui accorder. Il doit faire savoir quels droits il souhaite exercer au moment où la question lui est posée.",
      "",
      "3. NON-VÉRIFICATION DE L'IDENTITÉ DE L'AVOCAT",
      "À son arrivée au poste, l'avocat doit présenter sa carte d'identité pour vérification. Il doit être fouillé avant de descendre en cellule et ses armes doivent lui être retirées. Ses moyens de communication peuvent être pris, sans obligation.",
      "",
      "4. RÉGIME ALIMENTAIRE DU SUSPECT",
      "L'agent doit obligatoirement demander si le suspect présente des allergies ou d'autres soucis de santé avant de lui donner à boire ou à manger. Selon les problèmes signalés, un justificatif d'un médecin EMS enregistré au registre de la ville peut être exigé. La police distribue les vivres selon les disponibilités et ne peut être poursuivie si elle ne peut satisfaire des demandes trop précises.",
      "",
      "5. RESPECT DE LA VIE PRIVÉE",
      "L'agent n'a pas le droit d'écouter la conversation du suspect lors de son appel téléphonique. La pièce où se trouve le téléphone ne comporte ni caméra ni micro. Lors de l'entretien avec l'avocat, micros et caméras doivent également être éteints, et l'agent doit signaler expressément qu'il a bien tout coupé.",
      "",
      "6. TEST ADN",
      "Si l'avocat se présente pour défendre son client et que le test ADN n'a pas encore été effectué — uniquement lorsque la police ne dispose d'aucune pièce d'identité — il y a vice de procédure.",
      "",
      "7. PALPATION DE SÉCURITÉ",
      "L'agent doit obligatoirement procéder à une fouille avant l'entrée en cellule, pour sa sécurité et celle d'autrui.",
      "",
      "ACCUEIL DE L'AVOCAT — MARCHE À SUIVRE",
      "1. Prendre sa carte d'identité et vérifier son identité.",
      "2. Le fouiller avant la descente en cellule.",
      "3. Lui retirer ses armes (obligatoire).",
      "4. Lui retirer ses moyens de communication (facultatif).",
      "5. Avant l'entretien, éteindre micros et caméras et le lui signaler explicitement.",
    ].join("\n"),
    notes:
      "Seuls les sept vices ci-dessus sont des vices avérés ouvrant droit à une réduction de peine. Un vice de procédure n'entraîne pas nécessairement la libération du client : cela dépend de sa gravité et de son impact. Le barème des réductions de peine (15 % pour un avocat commis d'office, 50 % sous contrat, accord du Command Staff au-delà de 10 minutes) figure dans la fiche 1.2 et non dans celle-ci.",
  },
];

// ---------------------------------------------------------------------------
// Code pénal (jeu de départ)
// ---------------------------------------------------------------------------

// Le code pénal officiel du département est importé séparément depuis un CSV
// fourni par le commandement : voir prisma/import-penal-codes.ts.
const PENAL_CODES: {
  code: string;
  title: string;
  category: string;
  description?: string;
  fine?: number | null;
  jailTime?: number | null;
  points?: number | null;
}[] = [];

// ---------------------------------------------------------------------------
// Templates de rapports par défaut
// ---------------------------------------------------------------------------

type Field = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  help?: string;
};

const section = (title: string, fields: Field[]) => ({ title, fields });

const REPORT_TEMPLATES = [
  {
    code: "ARREST_REPORT",
    name: "Arrest Report",
    description:
      "Rapport d'arrestation",
    icon: "Handcuffs",
    minRankLevel: 37,
    requiresValidation: true,
    schema: [
      section("Identité du suspect", [
        { key: "suspect", label: "Nom et prénom du suspect", type: "civilian_picker", required: true, help: "Si l'identité est inconnue, indiquer « sous X »." },
        { key: "identified", label: "Papiers d'identité présentés", type: "checkbox" },
        { key: "dna_test", label: "Test ADN réalisé au poste", type: "checkbox", help: "Obligatoire si le suspect n'avait pas ses papiers." },
        { key: "suspect_address", label: "Adresse déclarée", type: "text" },
      ]),
      section("Circonstances de l'interpellation", [
        { key: "datetime", label: "Date et heure de l'interpellation", type: "datetime", required: true },
        { key: "location", label: "Lieu de l'interpellation", type: "text", required: true },
        { key: "call_sign", label: "Call sign de la patrouille", type: "select", options: ["Lincoln", "Adam", "Tango", "X-Ray", "Bertrand", "Henry", "Mary", "Victor", "Sierra", "David", "K9", "Goliath", "India"] },
        { key: "backup", label: "Agents présents", type: "officer_picker", help: "La mise en cellule exige au moins deux agents." },
        { key: "narrative", label: "Récit des faits", type: "textarea", required: true, help: "Chronologie factuelle, à la troisième personne." },
      ]),
      section("Fouille et saisies", [
        { key: "handcuffed", label: "Suspect menotté", type: "checkbox", help: "Obligatoire s'il est dangereux pour lui-même ou pour autrui." },
        { key: "search_done", label: "Fouille effectuée", type: "checkbox", required: true },
        { key: "seized_items", label: "Éléments saisis", type: "multiselect", options: ["Arme à feu", "Arme blanche", "Drogues", "Moyens de communication", "Argent liquide", "Autre"] },
        { key: "cash_amount", label: "Argent liquide saisi ($)", type: "number", help: "Au-delà de 10 000 $, faire tester par un banquier." },
        { key: "lab_analysis", label: "Analyse laboratoire demandée", type: "checkbox", help: "Obligatoire pour toute substance suspecte." },
        { key: "seizure_details", label: "Détail des saisies", type: "textarea" },
      ]),
      section("Lecture des droits Miranda", [
        { key: "miranda_read", label: "Droits Miranda lus", type: "checkbox", required: true },
        { key: "miranda_time", label: "Heure de lecture des droits", type: "datetime", required: true, help: "Doit intervenir dans les 15 minutes suivant le menottage." },
        { key: "miranda_count", label: "Nombre de lectures", type: "select", options: ["1", "2", "3"], help: "Après 3 lectures sans réponse valable, les droits sont réputés compris." },
        { key: "miranda_understood", label: "Réponse à « Avez-vous compris vos droits ? »", type: "select", options: ["OUI", "NON"], required: true },
        { key: "miranda_talk", label: "Réponse à « Voulez-vous encore me parler ? »", type: "select", options: ["OUI", "NON", "Sans objet"] },
        { key: "miranda_witness", label: "Lecture faite devant témoin", type: "checkbox" },
        { key: "miranda_rights_used", label: "Droits demandés par le suspect", type: "multiselect", options: ["Boire et manger", "Appel téléphonique", "Avocat", "Soins médicaux (EMS)"], help: "La demande d'avocat doit toujours être honorée en dernier." },
      ]),
      section("Chefs d'inculpation et peine", [
        { key: "charges", label: "Chefs d'inculpation", type: "penal_code_picker", required: true },
        { key: "lawyer_type", label: "Avocat du suspect", type: "select", options: ["Aucun", "Commis d'office (−15 %)", "Sous contrat (−50 %)"] },
        { key: "command_approval", label: "Accord du Command Staff obtenu", type: "officer_picker", help: "Requis pour toute réduction d'avocat sur une peine supérieure à 10 minutes." },
        { key: "officer_reduction", label: "Remise accordée par l'agent (min)", type: "number", help: "10 minutes maximum, selon la coopération du suspect." },
        { key: "federal_convoy", label: "Convoi fédéral effectué", type: "checkbox", help: "Obligatoire pour toute peine supérieure ou égale à 60 minutes." },
      ]),
      section("Mise en cellule", [
        { key: "second_search", label: "Seconde fouille à l'entrée du poste", type: "checkbox", required: true },
        { key: "belongings_stored", label: "Effets personnels déposés au casier", type: "checkbox" },
        { key: "medical_items", label: "Lunettes ou médicaments conservés", type: "text", help: "Les lunettes de vue ne se confisquent pas. Médicaments conservés sur ordonnance." },
        { key: "prisoner_outfit", label: "Tenue de prisonnier remise", type: "checkbox" },
        { key: "cell_number", label: "Cellule affectée", type: "text" },
        { key: "record_submitted", label: "Casier judiciaire soumis", type: "checkbox", required: true },
      ]),
      section("Signature", [
        { key: "signature", label: "Agent rédacteur", type: "signature", required: true, help: "Nom, prénom et numéro de badge." },
      ]),
    ],
  },
  {
    code: "INTERROGATION_REPORT",
    name: "Interrogation Report",
    description: "Compte rendu d'interrogatoire d'un suspect ou d'un témoin.",
    icon: "MessageSquareText",
    minRankLevel: 37,
    requiresValidation: true,
    schema: [
      section("Cadre de l'audition", [
        { key: "interviewee", label: "Personne auditionnée", type: "civilian_picker", required: true },
        { key: "capacity", label: "Qualité", type: "select", options: ["Suspect", "Témoin", "Victime"], required: true },
        { key: "datetime", label: "Date et heure", type: "datetime", required: true },
        { key: "location", label: "Lieu de l'audition", type: "text" },
        { key: "attorney_present", label: "Avocat présent", type: "checkbox" },
        { key: "recorded", label: "Audition enregistrée", type: "checkbox" },
      ]),
      section("Contenu", [
        { key: "questions", label: "Questions posées et réponses", type: "textarea", required: true },
        { key: "statements", label: "Déclarations notables", type: "textarea" },
        { key: "conclusion", label: "Analyse de l'enquêteur", type: "textarea" },
      ]),
    ],
  },
  {
    code: "OFFICER_REPORT",
    name: "Officer Report",
    description: "Rapport d'agent",
    icon: "FileText",
    minRankLevel: 37,
    requiresValidation: false,
    schema: [
      section("Informations générales", [
        { key: "subject", label: "Objet du rapport", type: "text", required: true },
        { key: "datetime", label: "Date et heure des faits", type: "datetime", required: true },
        { key: "location", label: "Lieu", type: "text" },
      ]),
      section("Exposé", [
        { key: "narrative", label: "Exposé des faits", type: "textarea", required: true },
        { key: "officers", label: "Agents impliqués", type: "officer_picker" },
        { key: "followup", label: "Suites à donner", type: "textarea" },
      ]),
    ],
  },
  {
    code: "USE_OF_FORCE_REPORT",
    name: "Use of Force / Shooting Report",
    description: "Rapport de tir ou d'usage de la force",
    icon: "Crosshair",
    minRankLevel: 37,
    requiresValidation: true,
    schema: [
      section("Contexte", [
        { key: "datetime", label: "Date et heure", type: "datetime", required: true },
        { key: "location", label: "Lieu", type: "text", required: true },
        { key: "incident_type", label: "Type d'intervention", type: "text", required: true },
      ]),
      section("Usage de la force", [
        { key: "force_type", label: "Type de force employée", type: "multiselect", required: true, options: ["Contrainte physique", "Matraque", "Taser", "Bean bag", "Gaz lacrymogène", "Arme à feu", "K9"] },
        { key: "weapon", label: "Arme utilisée", type: "select", options: ["Aucune", "Glock", "MP5", "Remington", "M4A1", "Bean bag"] },
        { key: "shots_fired", label: "Nombre de coups tirés", type: "number" },
        { key: "justification", label: "Justification de l'usage de la force", type: "textarea", required: true, help: "Menace perçue, sommations effectuées, alternatives envisagées." },
      ]),
      section("Conséquences", [
        { key: "subject", label: "Personne visée", type: "civilian_picker" },
        { key: "injuries", label: "Blessures constatées", type: "textarea" },
        { key: "medical", label: "Secours médicaux appelés", type: "checkbox" },
        { key: "witnesses", label: "Témoins", type: "textarea" },
        { key: "supervisor_notified", label: "Superviseur prévenu", type: "officer_picker", required: true },
      ]),
    ],
  },
  {
    code: "INCIDENT_REPORT",
    name: "Incident Report",
    description: "Rapport d'incident.",
    icon: "TriangleAlert",
    minRankLevel: 37,
    requiresValidation: false,
    schema: [
      section("Incident", [
        { key: "type", label: "Nature de l'incident", type: "text", required: true },
        { key: "datetime", label: "Date et heure", type: "datetime", required: true },
        { key: "location", label: "Lieu", type: "text", required: true },
        { key: "narrative", label: "Description", type: "textarea", required: true },
      ]),
      section("Personnes et biens", [
        { key: "victims", label: "Victimes", type: "civilian_picker" },
        { key: "witnesses", label: "Témoins", type: "civilian_picker" },
        { key: "vehicles", label: "Véhicules impliqués", type: "vehicle_picker" },
        { key: "damages", label: "Dégâts constatés", type: "textarea" },
      ]),
    ],
  },
  {
    code: "TRAFFIC_CITATION",
    name: "Traffic Citation",
    description: "Contravention routière.",
    icon: "Car",
    minRankLevel: 37,
    requiresValidation: false,
    schema: [
      section("Contrevenant", [
        { key: "driver", label: "Conducteur", type: "civilian_picker", required: true },
        { key: "vehicle", label: "Véhicule", type: "vehicle_picker", required: true },
      ]),
      section("Infraction", [
        { key: "datetime", label: "Date et heure", type: "datetime", required: true },
        { key: "location", label: "Lieu", type: "text", required: true },
        { key: "violations", label: "Infractions relevées", type: "penal_code_picker", required: true },
        { key: "speed", label: "Vitesse relevée (mph)", type: "number" },
        { key: "notes", label: "Observations", type: "textarea" },
      ]),
    ],
  },
];

// ---------------------------------------------------------------------------
// Cours d'académie de départ
// ---------------------------------------------------------------------------

// Les cours sont créés par les instructeurs depuis le module Académie.
const ACADEMY_COURSES: { code: string; title: string; description: string }[] =
  [];

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------

async function main() {
  console.log("→ Grades");
  // Les grades retirés du référentiel doivent partir AVANT les upserts :
  // `level` est unique, et un ancien grade occupant un niveau réattribué
  // ferait échouer l'insertion. On ne supprime que les grades sans titulaire.
  const keptRankCodes = RANKS.map((r) => r.code);
  const obsolete = await db.rank.findMany({
    where: { code: { notIn: keptRankCodes } },
    include: { _count: { select: { users: true } } },
  });
  for (const rank of obsolete) {
    if (rank._count.users === 0) {
      await db.rank.delete({ where: { id: rank.id } });
      console.log(`   grade obsolète supprimé : ${rank.code}`);
    } else {
      console.warn(
        `   ⚠️  grade « ${rank.code} » conservé : ${rank._count.users} agent(s) le portent encore.`,
      );
    }
  }

  for (const [i, r] of RANKS.entries()) {
    await db.rank.upsert({
      where: { code: r.code },
      update: { name: r.name, level: r.level, category: r.category, order: i },
      create: { ...r, order: i },
    });
  }

  console.log("→ Divisions, sous-unités et rôles internes");
  for (const [i, d] of DIVISIONS.entries()) {
    const division = await db.division.upsert({
      where: { code: d.code },
      update: { name: d.name, shortName: d.shortName, isRestricted: d.isRestricted, minRankLevel: d.minRankLevel ?? 38, order: i },
      create: { code: d.code, name: d.name, shortName: d.shortName, isRestricted: d.isRestricted, minRankLevel: d.minRankLevel ?? 38, order: i },
    });

    for (const [j, s] of d.subDivisions.entries()) {
      await db.subDivision.upsert({
        where: { code: s.code },
        update: { name: s.name, divisionId: division.id, order: j },
        create: { code: s.code, name: s.name, divisionId: division.id, order: j },
      });
    }

    for (const [j, role] of d.roles.entries()) {
      const sub = role.subDivision
        ? await db.subDivision.findUnique({ where: { code: role.subDivision } })
        : null;
      const payload = {
        name: role.name,
        divisionId: division.id,
        subDivisionId: sub?.id ?? null,
        isDivisionChief: role.isDivisionChief ?? false,
        isUnitLead: role.isUnitLead ?? false,
        canTrain: role.canTrain ?? false,
        order: j,
      };
      await db.divisionRole.upsert({
        where: { code: role.code },
        update: payload,
        create: { code: role.code, ...payload },
      });
    }
  }

  console.log("→ Certifications");
  for (const [i, c] of CERTIFICATIONS.entries()) {
    await db.certification.upsert({
      where: { code: c.code },
      update: { ...c, order: i },
      create: { ...c, order: i },
    });
  }

  console.log("→ Médailles");
  for (const [i, m] of MEDALS.entries()) {
    await db.medal.upsert({
      where: { code: m.code },
      update: { ...m, order: i },
      create: { ...m, order: i },
    });
  }

  console.log("→ Codes radio");
  for (const [i, c] of RADIO_CODES.entries()) {
    await db.radioCode.upsert({
      where: { category_code: { category: c.category, code: c.code } },
      update: { label: c.label, order: i },
      create: { ...c, order: i },
    });
  }

  console.log("→ Textes de référence");
  // Ordre d'affichage explicite : les fiches se lisent de 1.1 à 1.6, quelle
  // que soit leur position dans les tableaux ci-dessus.
  const TEXT_ORDER = [
    "MIRANDA",
    "REGLEMENT",
    "ARMEMENT_PAR_GRADE",
    "DISCIPLINE_RADIO",
    "ARRESTATION",
    "MISE_EN_CELLULE",
    "GESTION_DROITS",
    "NEGOCIATION",
    "ROLES_AGENTS",
    "BRAQUAGE",
    "AVOCATS",
  ];
  for (const t of [...REFERENCE_TEXTS, ...PROCEDURE_TEXTS]) {
    const order = TEXT_ORDER.indexOf(t.code);
    await db.referenceText.upsert({
      where: { code: t.code },
      update: { ...t, order: order === -1 ? 99 : order },
      create: { ...t, order: order === -1 ? 99 : order },
    });
  }

  console.log("→ Code pénal");
  for (const p of PENAL_CODES) {
    await db.penalCode.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
  }

  console.log("→ Épreuves d'examen d'académie");
  for (const [i, s] of ACADEMY_EXAM_SUBJECTS.entries()) {
    await db.academyExamSubject.upsert({
      where: { code: s.code },
      update: { name: s.name, maxPoints: s.maxPoints, order: i },
      create: { ...s, order: i },
    });
  }

  console.log("→ Cours d'académie");
  for (const [i, c] of ACADEMY_COURSES.entries()) {
    await db.academyCourse.upsert({
      where: { code: c.code },
      update: { title: c.title, description: c.description, order: i },
      create: { ...c, order: i },
    });
  }

  console.log("→ Templates de rapports");
  for (const [i, t] of REPORT_TEMPLATES.entries()) {
    const template = await db.reportTemplate.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        description: t.description,
        icon: t.icon,
        minRankLevel: t.minRankLevel,
        requiresValidation: t.requiresValidation,
        order: i,
      },
      create: {
        code: t.code,
        name: t.name,
        description: t.description,
        icon: t.icon,
        minRankLevel: t.minRankLevel,
        requiresValidation: t.requiresValidation,
        order: i,
      },
    });

    // Versionnage : si la définition a changé, on publie une nouvelle version
    // au lieu d'écraser l'ancienne. Les rapports déjà rédigés continuent ainsi
    // de s'afficher avec la structure qui avait cours à leur rédaction.
    const latest = await db.reportTemplateVersion.findFirst({
      where: { templateId: template.id },
      orderBy: { version: "desc" },
    });
    const changed =
      !latest || JSON.stringify(latest.schema) !== JSON.stringify(t.schema);

    if (changed) {
      await db.reportTemplateVersion.create({
        data: {
          templateId: template.id,
          version: (latest?.version ?? 0) + 1,
          schema: t.schema,
        },
      });
    }
  }

  console.log("→ Comptes de départ");
  await seedUsers();

  console.log("\n✅ Seed terminé.");
}

/** Mots de passe de départ — à changer impérativement après la première connexion. */
const DEFAULT_PASSWORD = "LSPD2026!";

async function seedUsers() {
  const rank = async (code: string) =>
    (await db.rank.findUniqueOrThrow({ where: { code } })).id;
  const passwordHash = await hash(DEFAULT_PASSWORD);

  /** Badge = matricule (2 chiffres) + 3 chiffres aléatoires. */
  const badgeFor = (matricule: string) =>
    `${matricule}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;

  type Spec = {
    firstName: string;
    lastName: string;
    matricule: string;
    rankCode: string;
    isSuperAdmin?: boolean;
    divisions?: { code: string; primary?: boolean }[];
    roles?: string[];
    subDivisions?: string[];
    certifications?: string[];
    union?: "REPRESENTATIVE" | "MEMBER";
    yearsAgo?: number;
  };

  // Seul le compte technique est créé ici : l'effectif réel du département est
  // chargé par `prisma/import-roster.ts`, transcrit depuis le tableau de bord
  // officiel. Ce compte sert au démarrage et de filet en cas de perte d'accès.
  const SPECS: Spec[] = [
    { firstName: "System", lastName: "Admin", matricule: "00", rankCode: "CHIEF_OF_POLICE", isSuperAdmin: true, yearsAgo: 5 },
      ];

  for (const spec of SPECS) {
    const email = `${spec.firstName.toLowerCase()}.${spec.lastName.toLowerCase()}@lspd.core`;
    const recruitedAt = new Date();
    recruitedAt.setFullYear(recruitedAt.getFullYear() - (spec.yearsAgo ?? 0));

    const user = await db.user.upsert({
      where: { email },
      update: {
        rankId: await rank(spec.rankCode),
        isSuperAdmin: spec.isSuperAdmin ?? false,
      },
      create: {
        firstName: spec.firstName,
        lastName: spec.lastName,
        email,
        passwordHash,
        matricule: spec.matricule,
        badgeNumber: badgeFor(spec.matricule),
        rankId: await rank(spec.rankCode),
        isSuperAdmin: spec.isSuperAdmin ?? false,
        recruitedAt,
      },
    });

    for (const d of spec.divisions ?? []) {
      const division = await db.division.findUniqueOrThrow({ where: { code: d.code } });
      await db.userDivision.upsert({
        where: { userId_divisionId: { userId: user.id, divisionId: division.id } },
        update: { isPrimary: d.primary ?? false },
        create: { userId: user.id, divisionId: division.id, isPrimary: d.primary ?? false },
      });
    }

    for (const code of spec.roles ?? []) {
      const role = await db.divisionRole.findUniqueOrThrow({ where: { code } });
      await db.userDivisionRole.upsert({
        where: { userId_divisionRoleId: { userId: user.id, divisionRoleId: role.id } },
        update: {},
        create: { userId: user.id, divisionRoleId: role.id },
      });
    }

    for (const code of spec.subDivisions ?? []) {
      const sub = await db.subDivision.findUniqueOrThrow({ where: { code } });
      await db.userSubDivision.upsert({
        where: { userId_subDivisionId: { userId: user.id, subDivisionId: sub.id } },
        update: {},
        create: { userId: user.id, subDivisionId: sub.id },
      });
    }

    for (const code of spec.certifications ?? []) {
      const cert = await db.certification.findUniqueOrThrow({ where: { code } });
      await db.userCertification.upsert({
        where: { userId_certificationId: { userId: user.id, certificationId: cert.id } },
        update: {},
        create: { userId: user.id, certificationId: cert.id },
      });
    }

    if (spec.union) {
      await db.unionMembership.upsert({
        where: { userId: user.id },
        update: { role: spec.union },
        create: { userId: user.id, role: spec.union },
      });
    }
  }

  console.log(`   ${SPECS.length} comptes — mot de passe commun : ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("\n❌ Échec du seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
