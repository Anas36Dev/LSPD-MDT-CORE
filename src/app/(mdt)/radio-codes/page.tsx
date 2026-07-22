import type { Metadata } from "next";

import { Badge, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Codes radio" };

const SECTIONS: {
  key: string;
  label: string;
  hint: string;
  codeWidth: string;
  wide?: boolean;
}[] = [
  {
    key: "TEN_CODE",
    label: "Codes radio",
    hint: "Communications courantes",
    codeWidth: "w-16",
  },
  {
    key: "PATROL_CODE",
    label: "Codes de patrouille",
    hint: "Conduite à tenir et niveau d'urgence",
    codeWidth: "w-20",
  },
  {
    key: "CALL_SIGN",
    label: "Call signs",
    hint: "Indicatif d'unité",
    codeWidth: "w-24",
  },
  {
    key: "WEAPON_CATEGORY",
    label: "Catégories d'armement",
    hint: "Classification réglementaire",
    codeWidth: "w-8",
  },
  // Les niveaux DEFCON ont désormais leur propre module, plus détaillé.
];

/**
 * Met en évidence (en bleu) les mentions entre parenthèses : ce sont les
 * informations à remplacer à l'oral lors de la lecture des droits.
 */
function highlightPlaceholders(text: string) {
  return text.split(/(\([^)]*\))/g).map((part, i) =>
    part.startsWith("(") && part.endsWith(")") ? (
      <span key={i} className="font-semibold text-badge-300">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default async function RadioCodesPage() {
  const user = await requireModule("radio-codes");

  const [codes, miranda] = await Promise.all([
    db.radioCode.findMany({ orderBy: { order: "asc" } }),
    db.referenceText.findUnique({ where: { code: "MIRANDA" } }),
  ]);

  const phonetic = codes.filter((c) => c.category === "PHONETIC");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Référentiel opérationnel
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Codes radio, call signs, droits Miranda, armement et alphabet
        </p>
      </div>

      {/* --- Droits Miranda : le texte le plus critique du terminal -------- */}
      {miranda ? (
        <Panel className="border-gold-500/30">
          <PanelHeader
            title={miranda.title}
            subtitle="À réciter dans les 15 minutes suivant le menottage"
            action={<Badge tone="gold">Par cœur</Badge>}
          />
          <div className="px-5 py-4">
            <blockquote className="border-l-2 border-gold-500/50 pl-4 text-sm leading-relaxed whitespace-pre-line text-mist-100">
              {highlightPlaceholders(miranda.content)}
            </blockquote>
            {miranda.notes ? (
              <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850/60 px-4 py-3">
                <p className="text-xs leading-relaxed whitespace-pre-line text-mist-300">
                  {miranda.notes}
                </p>
              </div>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {/* Colonnes façon maçonnerie : chaque section garde sa hauteur propre et
          comble l'espace, au lieu d'une grille rigide qui laisse un grand vide
          à côté de la longue liste des ten-codes. L'alphabet OTAN prend place
          dans une colonne de droite plutôt que de s'étaler seul tout en bas. */}
      <div className="columns-1 gap-6 md:columns-2 xl:columns-3 [&>*]:mb-6">
        {SECTIONS.map((section) => {
          const items = codes.filter((c) => c.category === section.key);
          if (items.length === 0) return null;

          return (
            <Panel key={section.key} className="break-inside-avoid">
              <PanelHeader title={section.label} subtitle={section.hint} />
              <ul className="divide-y divide-ink-700">
                {items.map((c) => (
                  <li key={c.id} className="flex gap-4 px-5 py-2">
                    <span
                      className={`${section.codeWidth} shrink-0 font-mono text-sm font-semibold text-badge-300`}
                    >
                      {c.code}
                    </span>
                    <span className="min-w-0 text-sm text-mist-100">
                      {c.label}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}

        {/* --- Alphabet OTAN : grille compacte, deux lettres par ligne ----- */}
        {phonetic.length > 0 ? (
          <Panel className="break-inside-avoid">
            <PanelHeader
              title="Alphabet phonétique de l'OTAN"
              subtitle="Épellation radio"
            />
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-5 py-4">
              {phonetic.map((c) => (
                <div key={c.id} className="flex items-baseline gap-2">
                  <span className="w-4 font-mono text-sm font-semibold text-badge-300">
                    {c.code}
                  </span>
                  <span className="text-sm text-mist-300">{c.label}</span>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
