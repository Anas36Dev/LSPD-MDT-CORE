import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@/generated/prisma";

// En développement, Next recharge les modules à chaque modification.
// Sans ce cache global, chaque rechargement ouvrirait un nouveau pool de
// connexions MySQL et XAMPP finirait par refuser les connexions.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL est absent. Vérifie le fichier .env à la racine de lspd-mdt.",
    );
  }
  // Prisma 7 exige un driver adapter ; PrismaMariaDb pilote aussi bien MySQL
  // que MariaDB, donc il fonctionne avec le MySQL fourni par XAMPP.
  return new PrismaClient({ adapter: new PrismaMariaDb(url) });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
