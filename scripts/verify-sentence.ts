/**
 * Vérification du calcul de peine, selon la fiche circulaire 1.2 :
 * « Les amendes sont cumulables mais pas la peine de prison.
 *   C'est toujours la peine de prison la plus longue qui prime ! »
 *
 *   npx tsx scripts/verify-sentence.ts
 */
import { computeSentence, type PenalEntry } from "../src/lib/report-schema";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    `   ${ok ? "✅" : "❌"} ${label}${ok ? "" : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`}`,
  );
  if (!ok) failures++;
}

const braquage: PenalEntry = {
  code: "PC 211",
  title: "Vol à main armée",
  fine: 40000,
  jailTime: 45,
};
const otage: PenalEntry = {
  code: "PC 10-60",
  title: "Prise d'otage",
  fine: 5500,
  jailTime: 60,
};
const exces: PenalEntry = {
  code: "VC 22350",
  title: "Excès de vitesse",
  fine: 1500,
  jailTime: null,
};

console.log("\n═══ CALCUL DE PEINE ═══\n");

console.log("Exemple officiel de la fiche circulaire 1.2");
console.log("  « braquage de supérette et prise d'otage »");
{
  const s = computeSentence([braquage, otage]);
  check("amendes cumulées", s.totalFine, 45500);
  check("peine = la plus longue, pas la somme", s.jailTime, 60);
  check("infraction déterminante", s.longestCharge, "Prise d'otage");
  check("convoi fédéral déclenché à 60 min", s.requiresFederalConvoy, true);
}

console.log("\nCumul des amendes avec une contravention sans prison");
{
  const s = computeSentence([braquage, otage, exces]);
  check("amendes cumulées", s.totalFine, 47000);
  check("peine inchangée", s.jailTime, 60);
}

console.log("\nRemise accordée par l'agent");
{
  const s = computeSentence([otage], { officerReduction: 10 });
  check("remise appliquée", s.finalJailTime, 50);
  check("convoi fédéral levé sous 60 min", s.requiresFederalConvoy, false);
}
{
  const s = computeSentence([otage], { officerReduction: 45 });
  check("remise plafonnée à 10 min", s.officerReduction, 10);
  check("peine finale", s.finalJailTime, 50);
}
{
  const s = computeSentence([otage], { officerReduction: -5 });
  check("remise négative ramenée à 0", s.officerReduction, 0);
}

console.log("\nRéduction de l'avocat");
{
  const s = computeSentence([otage], { lawyer: "COMMIS_OFFICE" });
  check("commis d'office : 15 % de 60", s.lawyerReduction, 9);
  check("peine finale", s.finalJailTime, 51);
  check("accord Command Staff requis", s.requiresCommandApproval, true);
}
{
  const s = computeSentence([otage], { lawyer: "SOUS_CONTRAT" });
  check("sous contrat : 50 % de 60", s.lawyerReduction, 30);
  check("peine finale", s.finalJailTime, 30);
}

console.log("\nCumul des deux réductions");
{
  const s = computeSentence([otage], {
    lawyer: "SOUS_CONTRAT",
    officerReduction: 10,
  });
  check("60 − 30 − 10", s.finalJailTime, 20);
}

console.log("\nSeuil d'accord du Command Staff");
{
  // Peine de 8 minutes : sous le seuil de 10 min, aucun accord requis.
  const petit: PenalEntry = { code: "X", title: "Outrage", fine: 1000, jailTime: 8 };
  const s = computeSentence([petit], { lawyer: "SOUS_CONTRAT" });
  check("peine ≤ 10 min : pas d'accord requis", s.requiresCommandApproval, false);
}
{
  const s = computeSentence([otage], { lawyer: "NONE" });
  check("sans avocat : pas d'accord requis", s.requiresCommandApproval, false);
}

console.log("\nCas limites");
{
  const s = computeSentence([]);
  check("aucun chef d'inculpation", [s.totalFine, s.jailTime], [0, 0]);
}
{
  const s = computeSentence([exces]);
  check("contravention sans prison", s.jailTime, 0);
  check("pas de convoi", s.requiresFederalConvoy, false);
}
{
  // Le convoi se déclenche À 60 minutes exactement (arbitrage du département).
  const pile: PenalEntry = { code: "Y", title: "Test", fine: 0, jailTime: 60 };
  const s = computeSentence([pile]);
  check("convoi fédéral à 60 min pile", s.requiresFederalConvoy, true);
}
{
  const s = computeSentence([{ code: "Z", title: "Test", fine: 0, jailTime: 59 }]);
  check("pas de convoi à 59 min", s.requiresFederalConvoy, false);
}
{
  const s = computeSentence([otage], {
    lawyer: "SOUS_CONTRAT",
    officerReduction: 10,
  });
  check("peine finale jamais négative", s.finalJailTime >= 0, true);
}

console.log("\nPerpétuité");
{
  const viol: PenalEntry = {
    code: "5.AE",
    title: "Viol",
    fine: 150000,
    jailTime: null,
    isLifeSentence: true,
    requiresDoj: true,
  };
  const s = computeSentence([viol, braquage]);
  check("perpétuité signalée", s.isLifeSentence, true);
  check("amendes toujours cumulées", s.totalFine, 190000);
  check("infraction déterminante", s.longestCharge, "Viol");
  check("convoi fédéral imposé", s.requiresFederalConvoy, true);
  check("DOJ signalé", s.requiresDoj, true);
}
{
  // Aucune remise ne s'applique à une perpétuité.
  const viol: PenalEntry = {
    code: "5.AE",
    title: "Viol",
    fine: 0,
    jailTime: null,
    isLifeSentence: true,
  };
  const s = computeSentence([viol], {
    lawyer: "SOUS_CONTRAT",
    officerReduction: 10,
  });
  check("remise avocat neutralisée", s.lawyerReduction, 0);
  check("remise agent neutralisée", s.officerReduction, 0);
  check("aucun accord Command Staff", s.requiresCommandApproval, false);
}

console.log("\nDepartment of Justice");
{
  const s = computeSentence([braquage]);
  check("aucun article DOJ", s.requiresDoj, false);
}
{
  const dojCharge: PenalEntry = {
    code: "3.A",
    title: "Abus de confiance",
    fine: 5000,
    jailTime: 25,
    requiresDoj: true,
  };
  const s = computeSentence([braquage, dojCharge]);
  check("un seul article DOJ suffit", s.requiresDoj, true);
  check("peine la plus longue conservée", s.jailTime, 45);
}

console.log(
  failures === 0
    ? `\n✅ Toutes les vérifications sont passées.\n`
    : `\n❌ ${failures} vérification(s) en échec.\n`,
);
process.exitCode = failures === 0 ? 0 : 1;
