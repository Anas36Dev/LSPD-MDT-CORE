/**
 * Vérification en LECTURE SEULE : combien de comptes acceptent encore le mot
 * de passe de seed « LSPD2026! » ? Argon2 étant salé, on ne peut pas comparer
 * les hash — on teste verify() compte par compte.
 *
 *   npx tsx scripts/check-default-password.ts
 *
 * Ne modifie rien.
 */
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { verify } from "@node-rs/argon2";

import { PrismaClient } from "../src/generated/prisma/client";

const DEFAULT_PASSWORD = "LSPD2026!";

const db = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

async function main() {
  const users = await db.user.findMany({
    select: {
      badgeNumber: true,
      firstName: true,
      lastName: true,
      passwordHash: true,
      status: true,
    },
  });

  const hits: string[] = [];
  for (const u of users) {
    const match = await verify(u.passwordHash, DEFAULT_PASSWORD).catch(
      () => false,
    );
    if (match) {
      hits.push(
        `  • ${u.badgeNumber} — ${u.firstName} ${u.lastName} [${u.status}]`,
      );
    }
  }

  console.log(`\nComptes analysés        : ${users.length}`);
  console.log(`Encore sur « LSPD2026! » : ${hits.length}`);
  if (hits.length) {
    console.log("\nDétail :");
    console.log(hits.join("\n"));
  } else {
    console.log("\n✅ Aucun compte n'utilise le mot de passe de seed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
