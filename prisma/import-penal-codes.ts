/**
 * Import du code pénal officiel de l'État de San Andreas depuis le CSV du
 * département.
 *
 *   npx tsx prisma/import-penal-codes.ts
 *   npx tsx prisma/import-penal-codes.ts "chemin/vers/un/autre.csv"
 *
 * Idempotent : relancé, il met à jour les articles existants et retire ceux qui
 * ont disparu du document. Le CSV reste la source de vérité.
 */
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

const DEFAULT_CSV = path.join(
  process.cwd(),
  "..",
  "docs",
  "LEGISLATIONS Rewind - Code Pénal.csv",
);

// ---------------------------------------------------------------------------
// Lecture CSV
// ---------------------------------------------------------------------------

/**
 * Analyseur CSV minimal mais correct : il gère les guillemets, les virgules
 * à l'intérieur des champs et les retours à la ligne encadrés — le document
 * en contient (« Conduite avec un véhicule non en état (plaque, dégradé...) »).
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Normalisation des valeurs
// ---------------------------------------------------------------------------

/**
 * Catégories et préfixe d'article correspondant.
 *
 * Le document numérote les articles par bloc : 1.x pour les contraventions,
 * 2.x pour les délits mineurs, etc. Ce lien permet de rattraper les coquilles
 * de saisie (un article 3.AL égaré au milieu du bloc 2.x).
 */
const CATEGORIES: Record<string, number> = {
  CONTRAVENTION: 1,
  "DELIT MINEUR": 2,
  "DELIT MAJEUR": 3,
  CRIME: 4,
  "CRIME FEDERAL": 5,
  "CRIME FINANCIER": 6,
};

/** « 1 500$ » → 1500 · « 0$ » → 0 · « - » → null */
function parseFine(raw: string): number | null {
  const cleaned = raw.replace(/[\s $]/g, "").replace(/,/g, "");
  if (!cleaned || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** « 25 » → 25 · « Perpétuité » → perpétuité · « - » → null */
function parseJail(raw: string): { minutes: number | null; life: boolean } {
  const cleaned = raw.trim();
  if (!cleaned || cleaned === "-") return { minutes: null, life: false };
  if (/perp/i.test(cleaned)) return { minutes: null, life: true };

  const n = Number(cleaned.replace(/[^\d]/g, ""));
  return { minutes: Number.isFinite(n) && n > 0 ? n : null, life: false };
}

/** « [J] 4.A » → « 4.A » — le préfixe indique le renvoi au juge. */
const cleanArticle = (raw: string) =>
  raw.replace(/\[[A-Z]\]/gi, "").trim().toUpperCase();

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------

async function main() {
  const csvPath = process.argv[2] ?? DEFAULT_CSV;

  if (!existsSync(csvPath)) {
    throw new Error(
      `Fichier introuvable : ${csvPath}\n` +
        `Dépose le CSV du code pénal dans le dossier docs/, ou passe son chemin en argument.`,
    );
  }

  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  console.log(`→ ${csvPath}`);
  console.log(`   ${rows.length} ligne(s) lue(s)\n`);

  type Entry = {
    code: string;
    title: string;
    category: string;
    description: string | null;
    fine: number | null;
    jailTime: number | null;
    isLifeSentence: boolean;
    requiresDoj: boolean;
    dojOnCumulation: boolean;
    order: number;
  };

  const entries: Entry[] = [];
  const seen = new Set<string>();

  // La catégorie n'est écrite que sur la première ligne de chaque bloc : on la
  // reporte tant qu'une nouvelle n'apparaît pas.
  let currentCategory = "";
  let order = 0;

  for (const row of rows) {
    const [, , rawCategory = "", rawDoj = "", rawArticle = "", rawTitle = "", rawFine = "", rawInfo = "", rawJail = ""] =
      row;

    const category = rawCategory.trim().toUpperCase();
    if (category in CATEGORIES) currentCategory = category;

    let code = cleanArticle(rawArticle);
    const title = rawTitle.trim();

    // On ne retient que les lignes portant un article et un intitulé : le
    // document contient un en-tête, un préambule et des lignes de mise en page.
    if (!/^\d+\.[A-Z]+$/.test(code) || !title) continue;
    if (!currentCategory) continue;

    // Le bloc dans lequel figure la ligne fait foi sur le préfixe saisi : une
    // coquille de numérotation ferait sinon disparaître un article valide.
    const expected = CATEGORIES[currentCategory];
    const [prefix, suffix] = code.split(".");

    if (Number(prefix) !== expected) {
      const corrected = `${expected}.${suffix}`;
      console.warn(
        `   ⚠️  Article ${code} (« ${title} ») se trouve dans le bloc ${currentCategory} : renuméroté en ${corrected}.`,
      );
      code = corrected;
    }

    if (seen.has(code)) {
      console.warn(
        `   ⚠️  Article ${code} en double (« ${title} ») : seconde occurrence ignorée.`,
      );
      continue;
    }
    seen.add(code);

    const doj = rawDoj.trim().toLowerCase();
    const { minutes, life } = parseJail(rawJail);
    const info = rawInfo.trim();

    entries.push({
      code,
      title,
      category: currentCategory,
      description: info && info !== "-" ? info : null,
      fine: parseFine(rawFine),
      jailTime: minutes,
      isLifeSentence: life,
      requiresDoj: doj === "oui",
      dojOnCumulation: doj.startsWith("cummul") || doj.startsWith("cumul"),
      order: order++,
    });
  }

  if (entries.length === 0) {
    throw new Error(
      "Aucun article reconnu. Le format du CSV a peut-être changé — vérifie que les colonnes sont bien : Catégorie, DOJ ?, Article, Infraction, Amende, Supplément, Peine.",
    );
  }

  // Remplacement intégral : le CSV fait foi, y compris pour les suppressions.
  const removed = await db.penalCode.deleteMany({
    where: { code: { notIn: entries.map((e) => e.code) } },
  });

  for (const entry of entries) {
    await db.penalCode.upsert({
      where: { code: entry.code },
      update: entry,
      create: entry,
    });
  }

  // --- Récapitulatif --------------------------------------------------------
  const byCategory = new Map<string, number>();
  for (const e of entries) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1);
  }

  console.log("   Articles importés par catégorie :");
  for (const cat of Object.keys(CATEGORIES)) {
    const n = byCategory.get(cat);
    if (n) console.log(`     ${String(n).padStart(3)}  ${cat}`);
  }

  const life = entries.filter((e) => e.isLifeSentence).length;
  const doj = entries.filter((e) => e.requiresDoj).length;
  const noJail = entries.filter((e) => !e.jailTime && !e.isLifeSentence).length;

  console.log(`\n   ${doj} article(s) relevant du DOJ`);
  console.log(`   ${life} peine(s) de perpétuité`);
  console.log(`   ${noJail} article(s) sans peine de détention`);
  if (removed.count) {
    console.log(`   ${removed.count} article(s) obsolète(s) retiré(s)`);
  }

  console.log(`\n✅ ${entries.length} articles en base.`);
}

main()
  .catch((e) => {
    console.error("\n❌ Import interrompu :", e.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
