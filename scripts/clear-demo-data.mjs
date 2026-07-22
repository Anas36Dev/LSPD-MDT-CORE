/**
 * Purge les données d'exemple insérées pendant le développement.
 *
 *   node scripts/clear-demo-data.mjs
 *
 * Ne touche PAS aux données réelles du département : agents, codes radio,
 * fiches circulaires, médailles, divisions, grades et certifications sont
 * conservés. Seuls les enregistrements opérationnels fictifs sont retirés.
 *
 * Les suppressions vont des tables filles vers les tables mères, pour ne pas
 * buter sur les contraintes de clé étrangère.
 */
import mariadb from "mariadb/promise.js";

const conn = await mariadb.createConnection({
  host: "localhost",
  user: "root",
  database: "lspd_mdt",
});

const TABLES = [
  // Rapports et pièces liées
  ["ReportCharge", "chefs d'inculpation de rapports"],
  ["ReportCivilian", "civils liés aux rapports"],
  ["ReportVehicle", "véhicules liés aux rapports"],
  ["ReportValidation", "décisions de validation"],
  ["Report", "rapports"],

  // Base civils
  ["FirearmCertificate", "certificats d'armes"],
  ["CriminalRecord", "entrées de casier"],
  ["License", "permis"],
  ["Bolo", "avis de recherche"],
  ["Warrant", "mandats"],
  ["Vehicle", "véhicules"],
  ["Civilian", "fiches civiles"],
];

console.log("→ Purge des données d'exemple\n");

let total = 0;
for (const [table, label] of TABLES) {
  const [{ n }] = await conn.query(`SELECT COUNT(*) n FROM \`${table}\``);
  const count = Number(n);

  if (count > 0) {
    await conn.query(`DELETE FROM \`${table}\``);
    console.log(`   ${String(count).padStart(3)} ${label} supprimé(s)`);
    total += count;
  }
}

console.log(
  total > 0
    ? `\n✅ ${total} enregistrement(s) retiré(s).`
    : "\n✅ Rien à purger, la base est déjà propre.",
);
console.log("   Agents, codes radio, fiches circulaires et médailles conservés.");

await conn.end();
