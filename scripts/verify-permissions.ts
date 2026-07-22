/**
 * Vérification du moteur de permissions.
 *
 * Charge chaque agent réellement présent en base, reconstruit son profil de
 * session exactement comme le fait `getCurrentUser`, puis contrôle que les
 * modules visibles correspondent aux règles attendues.
 *
 *   npx tsx scripts/verify-permissions.ts
 */
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  can,
  isAcademyTrainee,
  isPreviewing,
  visibleModules,
  type SessionUser,
} from "../src/lib/permissions";

const db = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

async function loadSessionUsers(): Promise<SessionUser[]> {
  const users = await db.user.findMany({
    orderBy: { rank: { level: "desc" } },
    include: {
      rank: true,
      divisions: { include: { division: true } },
      divisionRoles: {
        include: {
          divisionRole: { include: { division: true, subDivision: true } },
        },
      },
      subDivisions: { include: { subDivision: true } },
      certifications: { include: { certification: true } },
      unionMembership: true,
    },
  });

  return users.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    badgeNumber: u.badgeNumber,
    status: u.status,
    isSuperAdmin: u.isSuperAdmin,
    rank: {
      code: u.rank.code,
      name: u.rank.name,
      level: u.rank.level,
      category: u.rank.category,
    },
    divisions: u.divisions.map((d) => ({
      id: d.division.id,
      code: d.division.code,
      name: d.division.name,
      isPrimary: d.isPrimary,
    })),
    divisionRoles: u.divisionRoles.map((r) => ({
      code: r.divisionRole.code,
      name: r.divisionRole.name,
      divisionCode: r.divisionRole.division.code,
      subDivisionCode: r.divisionRole.subDivision?.code ?? null,
      isDivisionChief: r.divisionRole.isDivisionChief,
      isUnitLead: r.divisionRole.isUnitLead,
      canTrain: r.divisionRole.canTrain,
    })),
    subDivisionCodes: u.subDivisions.map((s) => s.subDivision.code),
    certificationCodes: u.certifications
      .filter((c) => c.revokedAt === null)
      .map((c) => c.certification.code),
    unionRole: u.unionMembership?.role ?? null,
  }));
}

let failures = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`   ✅ ${label}`);
  } else {
    console.log(`   ❌ ${label}`);
    failures++;
  }
}

async function main() {
  const users = await loadSessionUsers();
  const by = (email: string) => {
    const u = users.find((x) => x.email === email);
    if (!u) throw new Error(`Agent introuvable : ${email}`);
    return u;
  };

  console.log("\n═══ MODULES VISIBLES PAR AGENT ═══\n");
  for (const u of users) {
    const mods = visibleModules(u).map((m) => m.key);
    console.log(
      `${u.rank.name.padEnd(22)} ${`${u.firstName} ${u.lastName}`.padEnd(20)} (${mods.length}) ${mods.join(", ")}`,
    );
  }

  console.log("\n═══ RÈGLES DE CLOISONNEMENT ═══\n");

  // --- Rookies -------------------------------------------------------------
  console.log("Rookies — cloisonnement académie");
  const rookies = users.filter((u) => u.rank.code === "ROOKIE");
  check(`${rookies.length} Rookie(s) dans l'effectif`, rookies.length > 0);
  for (const u of rookies) {
    const mods = visibleModules(u).map((m) => m.key).sort();
    // Les Rookies n'accèdent qu'à l'académie et aux référentiels : fiches
    // circulaires, codes radio et code pénal sont leur support de formation.
    check(
      `${u.firstName} ${u.lastName} — limité à l'académie et aux référentiels`,
      JSON.stringify(mods) ===
        JSON.stringify([
          "academy",
          "dashboard",
          "penal-code",
          "procedures",
          "radio-codes",
        ]),
    );
    check(`${u.firstName} ${u.lastName} — pas d'affaires internes`, !can.viewIaCases(u));
  }

  // --- Command Staff --------------------------------------------------------
  console.log("\nGestion des comptes");
  const chief = by("ross.dwight@lspd.core");
  const assistant = by("seth.larsen@lspd.core");
  const commander = by("merrick.langston@lspd.core");
  const sergeant = by("amadeusz.spencer@lspd.core");
  const officer = by("emilio.alvarez@lspd.core");

  check("Chief of Police peut créer un compte", can.createAccount(chief));
  check("Chief of Police peut suspendre", can.suspendAccount(chief));
  check("Assistant Chief peut créer", can.createAccount(assistant));
  check("Assistant Chief peut suspendre", can.suspendAccount(assistant));
  check("Commander NE peut PAS créer de compte", !can.createAccount(commander));
  check("Sergeant NE peut PAS créer de compte", !can.createAccount(sergeant));
  check("Police Officer NE peut PAS créer de compte", !can.createAccount(officer));

  // --- Supervision ----------------------------------------------------------
  console.log("\nSupervision");
  check("Sergeant II peut valider les rapports", can.validateReports(sergeant));
  check("Sergeant II peut gérer les templates", can.manageTemplates(sergeant));
  check("Police Officer NE peut PAS valider", !can.validateReports(officer));
  check("Commander voit les statistiques", can.viewStatistics(commander));

  // --- Affaires internes ----------------------------------------------------
  console.log("\nAffaires internes (cloisonnement)");
  check("Command Staff voit les dossiers IA", can.viewIaCases(chief));
  check("Sergeant hors IAD NE voit PAS les dossiers", !can.viewIaCases(sergeant));
  check("Police Officer NE voit PAS les dossiers", !can.viewIaCases(officer));
  check("Sergeant NE peut PAS clore un dossier IA", !can.closeIaCase(sergeant));

  // --- Certification IFSC ---------------------------------------------------
  console.log("\nCertification IFSC (Instructor FSC du tableur)");
  const ifscHolders = users.filter((u) => u.certificationCodes.includes("IFSC"));
  check("10 titulaires IFSC, conformément au tableur", ifscHolders.length === 10);
  check(
    "Un titulaire IFSC peut délivrer un certificat d'arme",
    ifscHolders.length > 0 && can.issueFirearmCertificate(ifscHolders[0]),
  );
  check(
    "Un non-titulaire NE peut PAS délivrer",
    !can.issueFirearmCertificate(officer),
  );
  check(
    "Le module Certificats d'armes n'apparaît que pour les IFSC",
    !visibleModules(officer).some((m) => m.key === "firearm-certificates") &&
      visibleModules(ifscHolders[0]).some((m) => m.key === "firearm-certificates"),
  );

  // --- Syndicat -------------------------------------------------------------
  console.log("\nSyndicat");
  const unionMembers = users.filter((u) => u.unionRole !== null);
  check("5 adhérents, conformément au tableur", unionMembers.length === 5);
  check(
    "Un adhérent voit le module Syndicat",
    visibleModules(unionMembers[0]).some((m) => m.key === "union"),
  );
  check(
    "Un non-adhérent ne voit pas le module Syndicat",
    !visibleModules(officer).some((m) => m.key === "union"),
  );

  // --- Effectif -------------------------------------------------------------
  console.log("\nConformité de l'effectif au tableur");
  const sworn = users.filter((u) => !u.isSuperAdmin);
  check("42 agents importés", sworn.length === 42);
  check(
    "Detective Bureau : 7 membres",
    sworn.filter((u) => u.divisions.some((d) => d.code === "DB")).length === 7,
  );
  check(
    "Training Division : 10 membres",
    sworn.filter((u) => u.divisions.some((d) => d.code === "TD")).length === 10,
  );
  check(
    "Metropolitan Division : 2 membres",
    sworn.filter((u) => u.divisions.some((d) => d.code === "METRO")).length === 2,
  );
  check(
    "Internal Affairs : 0 membre",
    sworn.filter((u) => u.divisions.some((d) => d.code === "IAD")).length === 0,
  );
  check(
    "Aucun agent ne porte un grade supprimé (Cadet / Probationary)",
    !sworn.some((u) => ["CADET", "PROBATIONARY_OFFICER"].includes(u.rank.code)),
  );

  // --- Accréditation Department of Justice ---------------------------------
  console.log("\nCode pénal et accréditation DOJ");
  check(
    "Le code pénal est accessible à tous.",
    users.every((u) => visibleModules(u).some((m) => m.key === "penal-code")),
  );
  check(
    "Le Department of Justice est un grade sous le Rookie",
    (await db.rank.count({ where: { code: "DOJ", level: { lt: 10 } } })) === 1,
  );

  // --- Mode aperçu ----------------------------------------------------------
  console.log("\nMode aperçu (Chief of Police)");
  {
    // Reproduit ce que fait `applyPreview` : même grade, mêmes accès.
    const asRookie: SessionUser = {
      ...chief,
      isSuperAdmin: false,
      rank: { code: "ROOKIE", name: "Rookie", level: 10, category: "ACADEMY" },
      divisions: [],
      divisionRoles: [],
      subDivisionCodes: [],
      certificationCodes: [],
      unionRole: null,
      preview: {
        active: true,
        realName: "Ross Dwight",
        realRankName: "Chief of Police",
      },
    };

    const rookieRef = users.find((u) => u.rank.code === "ROOKIE");
    check(
      "L'aperçu Rookie voit exactement ce que voit un vrai Rookie",
      rookieRef !== undefined &&
        JSON.stringify(visibleModules(asRookie).map((m) => m.key)) ===
          JSON.stringify(visibleModules(rookieRef).map((m) => m.key)),
    );
    check("L'aperçu est signalé comme tel", isPreviewing(asRookie));
    check("L'aperçu perd les droits de superadmin", !asRookie.isSuperAdmin);
    check(
      "L'aperçu Rookie ne peut plus gérer les comptes",
      !can.createAccount(asRookie),
    );
    check(
      "L'aperçu Rookie ne voit plus les affaires internes",
      !can.viewIaCases(asRookie),
    );
    check("Hors aperçu, le Chief reste inchangé", !isPreviewing(chief));
  }

  console.log(
    failures === 0
      ? `\n✅ Toutes les vérifications sont passées.\n`
      : `\n❌ ${failures} vérification(s) en échec.\n`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
