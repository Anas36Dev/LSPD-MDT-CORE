/**
 * Régénère le mot de passe d'un compte unique (par défaut le badge 00636 —
 * System Admin) avec un mot de passe fort, puis :
 *   - écrit le hash argon2 en base,
 *   - dépose le mot de passe en clair dans .credentials/ (dossier gitignoré),
 *   - l'affiche une seule fois en console.
 *
 *   npx tsx scripts/reset-admin-password.ts [badgeNumber]
 *
 * Politique du mot de passe : >= 14 caractères, minuscules + majuscules +
 * chiffres, et au moins 3 caractères spéciaux.
 */
import "dotenv/config";
import { randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hash } from "@node-rs/argon2";

import { PrismaClient } from "../src/generated/prisma/client";

const TARGET_BADGE = process.argv[2] ?? "00636";
const LENGTH = 18; // > 14 pour une marge confortable
const SPECIALS_MIN = 3;

const LOWER = "abcdefghijkmnpqrstuvwxyz"; // sans l/o pour éviter les confusions
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sans I/O
const DIGITS = "23456789"; // sans 0/1
const SPECIAL = "!@#$%&*?-_=+";

const db = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

/** Tirage sécurisé dans une chaîne. */
const pick = (chars: string) => chars[randomInt(chars.length)];

function generatePassword(): string {
  const chars: string[] = [];
  // Garanties de composition.
  chars.push(pick(LOWER), pick(UPPER), pick(DIGITS));
  for (let i = 0; i < SPECIALS_MIN; i++) chars.push(pick(SPECIAL));
  // Le reste : alphanumérique.
  const alnum = LOWER + UPPER + DIGITS;
  while (chars.length < LENGTH) chars.push(pick(alnum));
  // Mélange Fisher–Yates sécurisé pour ne pas figer l'ordre des garanties.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function main() {
  const user = await db.user.findUnique({
    where: { badgeNumber: TARGET_BADGE },
    select: { id: true, badgeNumber: true, firstName: true, lastName: true },
  });
  if (!user) throw new Error(`Aucun compte avec le badge ${TARGET_BADGE}.`);

  const password = generatePassword();
  const passwordHash = await hash(password);

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  // Révoque les sessions actives : l'ancien mot de passe ne doit plus donner
  // accès via une session ouverte.
  const revoked = await db.session.deleteMany({ where: { userId: user.id } });

  const dir = join(process.cwd(), ".credentials");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `admin-${user.badgeNumber}.txt`);
  const body = [
    "LSPD MDT — identifiant de connexion (À GARDER SECRET)",
    "======================================================",
    `Badge          : ${user.badgeNumber}`,
    `Agent          : ${user.firstName} ${user.lastName}`,
    `Mot de passe   : ${password}`,
    "",
    `Régénéré le    : ${new Date().toISOString()}`,
    `Sessions purgées : ${revoked.count}`,
    "",
    "Ce fichier est dans .credentials/ (gitignoré). Ne le committe jamais.",
    "Change ce mot de passe après la première reconnexion si possible.",
    "",
  ].join("\n");
  writeFileSync(file, body, { encoding: "utf8" });

  console.log(`\n✅ Mot de passe régénéré pour ${user.badgeNumber} (${user.firstName} ${user.lastName}).`);
  console.log(`   Sessions actives purgées : ${revoked.count}`);
  console.log(`   Mot de passe : ${password}`);
  console.log(`   Copie sauvegardée : ${file}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
