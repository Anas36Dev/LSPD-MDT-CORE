/**
 * Crée une session valide pour un agent et affiche son cookie.
 * Sert aux tests manuels du cloisonnement sans passer par le formulaire.
 *
 *   node scripts/make-session.mjs prenom.nom@lspd.core
 */
import { randomBytes } from "node:crypto";
import mariadb from "mariadb/promise.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/make-session.mjs <email>");
  process.exit(1);
}

const conn = await mariadb.createConnection({
  host: "localhost",
  user: "root",
  database: "lspd_mdt",
});

const [user] = await conn.query("SELECT id FROM User WHERE email = ?", [email]);
if (!user) {
  console.error("Agent introuvable :", email);
  process.exit(1);
}

const id = randomBytes(32).toString("hex");
await conn.query(
  "INSERT INTO Session (id, userId, expiresAt, createdAt) VALUES (?, ?, ?, NOW())",
  [id, user.id, new Date(Date.now() + 3600_000)],
);
console.log(id);
await conn.end();
