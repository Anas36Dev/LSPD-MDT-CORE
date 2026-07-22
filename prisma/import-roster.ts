/**
 * Import de l'effectif réel du LSPD, transcrit depuis le tableur du département.
 *
 * Ce script REMPLACE les comptes de démonstration créés par le seed initial.
 * Le compte technique SUPERADMIN est conservé.
 *
 *   npx tsx prisma/import-roster.ts
 *
 * Il est idempotent : relancé, il met à jour les agents existants plutôt que
 * d'en créer des doublons.
 */
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hash } from "@node-rs/argon2";

import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

/** Mot de passe initial commun — à faire changer par la hiérarchie. */
const DEFAULT_PASSWORD = "LSPD2026!";

/**
 * Correspondance entre les libellés du tableur et les codes du MDT.
 * Le tableur écrit « Officer III » ; le département a retenu le libellé
 * officiel « Police Officer III » pour le MDT.
 */
const RANK_MAP: Record<string, string> = {
  "Chief of Police": "CHIEF_OF_POLICE",
  "Assistant Chief": "ASSISTANT_CHIEF",
  "Deputy Chief": "DEPUTY_CHIEF",
  Commander: "COMMANDER",
  "Captain III": "CAPTAIN_III",
  "Captain II": "CAPTAIN_II",
  "Captain I": "CAPTAIN_I",
  "Lieutenant II": "LIEUTENANT_II",
  "Lieutenant I": "LIEUTENANT_I",
  "Sergeant II": "SERGEANT_II",
  "Sergeant I": "SERGEANT_I",
  "Detective III": "DETECTIVE_III",
  "Detective II": "DETECTIVE_II",
  "Detective I": "DETECTIVE_I",
  "Officer III+1": "POLICE_OFFICER_III_1",
  "Officer III": "POLICE_OFFICER_III",
  "Officer II": "POLICE_OFFICER_II",
  "Officer I": "POLICE_OFFICER_I",
  Rookie: "ROOKIE",
};

/** Colonnes « division » du tableur → codes de division du MDT. */
const DIVISION_MAP: Record<string, string> = {
  MET: "METRO",
  ASD: "ASD",
  DB: "DB",
  TD: "TD",
  IAD: "IAD",
  PCG: "PCG",
};

type Row = {
  mat: string;
  first: string;
  last: string;
  rank: string;
  recruited: string; // jj/mm/aaaa
  recruiter: string; // matricule, "00" = aucun
  /** Divisions et marqueurs transverses : MET, ASD, DB, TD, IAD, PCG, FSC, SYND */
  tags: string[];
  medals: string[];
};

// Transcription fidèle du tableur — 42 agents.
const ROSTER: Row[] = [
  { mat: "28", first: "Ross", last: "Dwight", rank: "Chief of Police", recruited: "28/02/2020", recruiter: "28", tags: ["FSC"], medals: ["MOH", "MSM", "ESM", "PS"] },
  { mat: "02", first: "Seth", last: "Larsen", rank: "Assistant Chief", recruited: "14/08/2025", recruiter: "28", tags: ["MET", "FSC"], medals: ["DSM", "MSM", "PS"] },
  { mat: "19", first: "Merrick", last: "Langston", rank: "Commander", recruited: "07/07/2024", recruiter: "28", tags: ["TD", "PCG", "FSC"], medals: ["PS"] },
  { mat: "16", first: "Veek", last: "Kay", rank: "Lieutenant I", recruited: "21/03/2021", recruiter: "28", tags: ["FSC"], medals: ["PS"] },
  { mat: "82", first: "Mario", last: "Da Silva", rank: "Lieutenant I", recruited: "01/01/2024", recruiter: "28", tags: ["DB", "FSC"], medals: [] },
  { mat: "30", first: "Noah", last: "Elijah", rank: "Lieutenant I", recruited: "14/05/2025", recruiter: "28", tags: ["ASD", "FSC"], medals: ["MSM"] },
  { mat: "27", first: "Reinhard", last: "Rosenberg", rank: "Detective III", recruited: "15/07/2020", recruiter: "28", tags: ["DB"], medals: ["MSM", "PS"] },
  { mat: "73", first: "Amadeusz", last: "Spencer", rank: "Sergeant II", recruited: "15/07/2023", recruiter: "28", tags: ["MET", "FSC", "SYND"], medals: ["ESM"] },
  { mat: "77", first: "Andrew", last: "Roberttson", rank: "Sergeant II", recruited: "10/02/2026", recruiter: "28", tags: ["FSC"], medals: [] },
  { mat: "69", first: "Terry", last: "Barnes", rank: "Detective II", recruited: "21/03/2021", recruiter: "28", tags: ["DB"], medals: ["DSM", "PS"] },
  { mat: "88", first: "Dave", last: "Murphy", rank: "Detective II", recruited: "26/04/2021", recruiter: "28", tags: ["DB"], medals: [] },
  { mat: "93", first: "Elijah", last: "Nolan", rank: "Sergeant I", recruited: "19/02/2023", recruiter: "28", tags: ["FSC"], medals: [] },
  { mat: "24", first: "Owen", last: "Sterling", rank: "Sergeant I", recruited: "26/07/2025", recruiter: "19", tags: ["FSC"], medals: [] },
  { mat: "05", first: "Savage", last: "Kasady", rank: "Detective I", recruited: "15/07/2023", recruiter: "28", tags: ["DB"], medals: [] },
  { mat: "32", first: "Samuel", last: "Martinez", rank: "Detective I", recruited: "01/01/2024", recruiter: "28", tags: ["DB"], medals: [] },
  { mat: "98", first: "Michael", last: "Reynolds", rank: "Detective I", recruited: "21/07/2024", recruiter: "28", tags: ["DB", "SYND"], medals: [] },
  { mat: "97", first: "Tyler", last: "Hallow", rank: "Officer III", recruited: "05/05/2020", recruiter: "28", tags: ["TD"], medals: [] },
  { mat: "78", first: "James", last: "Brown", rank: "Officer III", recruited: "09/09/2020", recruiter: "28", tags: ["TD"], medals: [] },
  { mat: "94", first: "Tyler", last: "Brooks", rank: "Officer III", recruited: "04/04/2021", recruiter: "28", tags: ["TD"], medals: [] },
  { mat: "08", first: "Peter", last: "Kent", rank: "Officer III", recruited: "15/07/2023", recruiter: "28", tags: ["TD"], medals: [] },
  { mat: "45", first: "Amaury", last: "Bryan", rank: "Officer III", recruited: "09/07/2024", recruiter: "19", tags: ["TD", "SYND"], medals: [] },
  { mat: "13", first: "Mia", last: "O'Connor", rank: "Officer III", recruited: "14/05/2025", recruiter: "30", tags: ["TD"], medals: [] },
  { mat: "67", first: "Lewis", last: "Anderson", rank: "Officer III", recruited: "06/07/2026", recruiter: "19", tags: ["TD"], medals: [] },
  { mat: "06", first: "Owen", last: "Da Silva", rank: "Officer III", recruited: "14/07/2026", recruiter: "28", tags: ["TD"], medals: [] },
  { mat: "35", first: "Miguel", last: "Santiago", rank: "Officer III", recruited: "14/07/2026", recruiter: "16", tags: ["TD"], medals: [] },
  { mat: "12", first: "Emilio", last: "Alvarez", rank: "Officer II", recruited: "10/09/2021", recruiter: "28", tags: [], medals: [] },
  { mat: "50", first: "Nate", last: "Holloways", rank: "Officer II", recruited: "29/03/2025", recruiter: "28", tags: [], medals: [] },
  { mat: "95", first: "Alejandro", last: "Juarez", rank: "Officer II", recruited: "05/08/2025", recruiter: "28", tags: [], medals: [] },
  { mat: "23", first: "Rubis", last: "Hyial", rank: "Officer II", recruited: "01/09/2025", recruiter: "28", tags: [], medals: [] },
  { mat: "70", first: "John", last: "Copernic", rank: "Officer II", recruited: "01/02/2026", recruiter: "28", tags: [], medals: [] },
  { mat: "37", first: "Rafael", last: "Vargas", rank: "Officer II", recruited: "12/06/2026", recruiter: "28", tags: ["SYND"], medals: [] },
  { mat: "18", first: "Franck", last: "Carter", rank: "Officer II", recruited: "14/07/2026", recruiter: "16", tags: [], medals: [] },
  { mat: "41", first: "Clayton", last: "Briggs", rank: "Officer I", recruited: "15/10/2025", recruiter: "28", tags: [], medals: [] },
  { mat: "01", first: "John", last: "Blake", rank: "Officer I", recruited: "19/02/2026", recruiter: "28", tags: [], medals: [] },
  { mat: "17", first: "Malcolm", last: "Layat", rank: "Officer I", recruited: "16/07/2026", recruiter: "00", tags: [], medals: [] },
  { mat: "22", first: "Kiara", last: "Kyle", rank: "Officer I", recruited: "16/07/2026", recruiter: "00", tags: [], medals: [] },
  { mat: "11", first: "Edwin", last: "Caldin", rank: "Rookie", recruited: "10/07/2025", recruiter: "28", tags: ["SYND"], medals: [] },
  { mat: "04", first: "Los", last: "Low", rank: "Rookie", recruited: "10/07/2025", recruiter: "28", tags: [], medals: [] },
  { mat: "07", first: "Nikolaï", last: "Davis", rank: "Rookie", recruited: "10/05/2026", recruiter: "28", tags: [], medals: [] },
  { mat: "81", first: "Kekoa", last: "Thompson", rank: "Rookie", recruited: "25/06/2026", recruiter: "28", tags: [], medals: [] },
  { mat: "15", first: "Jack", last: "Wagner", rank: "Rookie", recruited: "05/07/2026", recruiter: "19", tags: [], medals: [] },
  { mat: "09", first: "Roxy", last: "Carter", rank: "Rookie", recruited: "15/07/2026", recruiter: "28", tags: [], medals: [] },
];

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

const emailOf = (r: Row) => `${slug(r.first)}.${slug(r.last)}@lspd.core`;

/** jj/mm/aaaa → Date. Le serveur suit un calendrier RP, aucune validation. */
function parseDate(s: string) {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const usedBadges = new Set<string>();
function badgeFor(matricule: string) {
  for (;;) {
    const badge = `${matricule}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    if (!usedBadges.has(badge)) {
      usedBadges.add(badge);
      return badge;
    }
  }
}

async function main() {
  // ---- Contrôles d'intégrité avant toute écriture --------------------------
  const mats = ROSTER.map((r) => r.mat);
  const dupMats = mats.filter((m, i) => mats.indexOf(m) !== i);
  if (dupMats.length) throw new Error(`Matricules en double : ${dupMats.join(", ")}`);

  const emails = ROSTER.map(emailOf);
  const dupEmails = emails.filter((e, i) => emails.indexOf(e) !== i);
  if (dupEmails.length) {
    throw new Error(`Identifiants en double : ${dupEmails.join(", ")}`);
  }

  for (const r of ROSTER) {
    if (!RANK_MAP[r.rank]) throw new Error(`Grade inconnu : « ${r.rank} » (${r.mat})`);
  }

  console.log(`→ ${ROSTER.length} agents à importer, aucun doublon détecté.`);

  // ---- Suppression des comptes de démonstration ---------------------------
  const realEmails = new Set(emails);
  const demo = await db.user.findMany({
    where: { isSuperAdmin: false, email: { notIn: [...realEmails] } },
    select: { id: true, email: true, discordId: true },
  });

  // Un rattachement Discord posé sur un compte de démo est reporté sur
  // l'agent réel de matricule 28 : c'est le compte du Chief of Police.
  const discordToTransfer = demo.find((d) => d.discordId)?.discordId ?? null;

  if (demo.length) {
    await db.user.deleteMany({ where: { id: { in: demo.map((d) => d.id) } } });
    console.log(`→ ${demo.length} compte(s) de démonstration supprimé(s).`);
  }

  // ---- Référentiels --------------------------------------------------------
  const ranks = new Map(
    (await db.rank.findMany()).map((r) => [r.code, r.id] as const),
  );
  const divisions = new Map(
    (await db.division.findMany()).map((d) => [d.code, d.id] as const),
  );
  const medals = new Map(
    (await db.medal.findMany()).map((m) => [m.code, m.id] as const),
  );
  const ifsc = await db.certification.findUnique({ where: { code: "IFSC" } });

  const passwordHash = await hash(DEFAULT_PASSWORD);

  // ---- Création / mise à jour des agents ----------------------------------
  const idByMatricule = new Map<string, number>();

  for (const r of ROSTER) {
    const email = emailOf(r);
    const rankId = ranks.get(RANK_MAP[r.rank]);
    if (!rankId) throw new Error(`Grade absent en base : ${RANK_MAP[r.rank]}`);

    const existing = await db.user.findUnique({ where: { email } });

    const user = await db.user.upsert({
      where: { email },
      update: {
        firstName: r.first,
        lastName: r.last,
        matricule: r.mat,
        rankId,
        recruitedAt: parseDate(r.recruited),
      },
      create: {
        firstName: r.first,
        lastName: r.last,
        email,
        passwordHash,
        matricule: r.mat,
        badgeNumber: badgeFor(r.mat),
        rankId,
        recruitedAt: parseDate(r.recruited),
      },
    });
    idByMatricule.set(r.mat, user.id);
    if (!existing) usedBadges.add(user.badgeNumber);

    // Divisions (remplacement intégral)
    const divisionCodes = r.tags
      .map((t) => DIVISION_MAP[t])
      .filter(Boolean) as string[];

    // Tout agent assermenté sans division spécialisée relève de Patrol
    // Division par défaut. Les Rookies, eux, restent à l'académie.
    if (divisionCodes.length === 0 && r.rank !== "Rookie") {
      divisionCodes.push("PATROL");
    }

    await db.userDivision.deleteMany({ where: { userId: user.id } });
    if (divisionCodes.length) {
      await db.userDivision.createMany({
        data: divisionCodes.map((code, i) => ({
          userId: user.id,
          divisionId: divisions.get(code)!,
          isPrimary: i === 0,
        })),
      });
    }

    // Instructor FSC → certification IFSC
    if (ifsc) {
      if (r.tags.includes("FSC")) {
        await db.userCertification.upsert({
          where: {
            userId_certificationId: { userId: user.id, certificationId: ifsc.id },
          },
          update: { revokedAt: null },
          create: { userId: user.id, certificationId: ifsc.id },
        });
      } else {
        await db.userCertification.deleteMany({
          where: { userId: user.id, certificationId: ifsc.id },
        });
      }
    }

    // Syndicat
    if (r.tags.includes("SYND")) {
      await db.unionMembership.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, role: "MEMBER" },
      });
    } else {
      await db.unionMembership.deleteMany({ where: { userId: user.id } });
    }

    // Décorations
    await db.userMedal.deleteMany({ where: { userId: user.id } });
    for (const code of r.medals) {
      const medalId = medals.get(code);
      if (!medalId) throw new Error(`Médaille inconnue : ${code}`);
      // Décorations antérieures au MDT : ni citation ni date connues.
      // La hiérarchie les renseignera depuis la fiche de l'agent.
      await db.userMedal.create({
        data: { userId: user.id, medalId, citation: null, awardedAt: null },
      });
    }
  }

  // ---- Recruteurs (2e passe : tous les agents existent désormais) ----------
  let linked = 0;
  for (const r of ROSTER) {
    const userId = idByMatricule.get(r.mat)!;
    const recruiterId =
      r.recruiter !== "00" ? idByMatricule.get(r.recruiter) : undefined;

    // Un agent ne peut pas être son propre recruteur.
    const valid = recruiterId && recruiterId !== userId ? recruiterId : null;
    await db.user.update({ where: { id: userId }, data: { recruiterId: valid } });
    if (valid) linked++;
  }
  console.log(`→ ${linked} lien(s) de recrutement établi(s).`);

  // ---- Report du rattachement Discord -------------------------------------
  if (discordToTransfer) {
    const chief = idByMatricule.get("28");
    if (chief) {
      await db.user.update({
        where: { id: chief },
        data: { discordId: discordToTransfer },
      });
      console.log(`→ Rattachement Discord reporté sur le matricule 28 (Ross Dwight).`);
    }
  }

  // ---- Nettoyage des grades et médailles hérités du jeu de démonstration ---
  const obsoleteRanks = ["CADET", "PROBATIONARY_OFFICER"];
  for (const code of obsoleteRanks) {
    const rank = await db.rank.findUnique({
      where: { code },
      include: { _count: { select: { users: true } } },
    });
    if (rank && rank._count.users === 0) {
      await db.rank.delete({ where: { code } });
      console.log(`→ Grade inutilisé supprimé : ${code}`);
    }
  }

  const keptMedals = ["MOH", "DSM", "MSM", "ESM", "PS"];
  const removed = await db.medal.deleteMany({
    where: { code: { notIn: keptMedals }, recipients: { none: {} } },
  });
  if (removed.count) {
    console.log(`→ ${removed.count} médaille(s) hors référentiel supprimée(s).`);
  }

  // ---- Récapitulatif -------------------------------------------------------
  const total = await db.user.count({ where: { isSuperAdmin: false } });
  console.log(`\n✅ Effectif importé : ${total} agents.`);
  console.log(`   Mot de passe initial commun : ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("\n❌ Import interrompu :", e.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
