/**
 * Crée un casier judiciaire pour chaque agent du LSPD qui n'en a pas encore.
 *
 *   npx tsx prisma/backfill-civilians.ts
 *
 * Tout agent de police est aussi un citoyen : il doit exister au registre.
 * Le Department of Justice et le compte technique en sont exclus.
 * Idempotent : le lien `agentId` évite tout doublon.
 */
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

async function main() {
  // Auteur des casiers générés : le compte technique (superadmin).
  const author = await db.user.findFirst({
    where: { isSuperAdmin: true },
    select: { id: true },
  });
  if (!author) throw new Error("Aucun compte technique (superadmin) trouvé.");

  const agents = await db.user.findMany({
    where: {
      isSuperAdmin: false,
      rank: { code: { not: "DOJ" } },
      civilianRecord: null,
    },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });

  // Séquence annuelle des références CASIER-YYYY-####.
  const year = new Date().getFullYear();
  const base = `CASIER-${year}-`;
  const last = await db.civilian.findFirst({
    where: { reference: { startsWith: base } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  let seq = last ? Number(last.reference.slice(base.length)) : 0;

  for (const a of agents) {
    seq += 1;
    await db.civilian.create({
      data: {
        reference: `${base}${String(seq).padStart(4, "0")}`,
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone,
        agentId: a.id,
        authorId: author.id,
        notes: "Casier généré automatiquement à l'ouverture du compte.",
      },
    });
  }

  const total = await db.civilian.count();
  console.log(`✅ ${agents.length} casier(s) créé(s) pour des agents.`);
  console.log(`   ${total} casiers en base au total.`);
}

main()
  .catch((e) => {
    console.error("❌ Échec :", e.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
