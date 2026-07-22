import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";

export const metadata: Metadata = { title: "Procédures" };

/** Première ligne utile du texte, pour donner un aperçu dans la liste. */
function excerpt(content: string, max = 160) {
  const line =
    content
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 20 && l === l.toLowerCase().replace(/^$/, l)) ??
    content.trim();

  return line.length > max ? `${line.slice(0, max)}…` : line;
}

export default async function ProceduresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireModule("procedures");
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const texts = await db.referenceText.findMany({
    where: {
      category: "CIRCULAIRE",
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { content: { contains: query } },
              { notes: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: { order: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Fiches circulaires
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Procédures officielles du département — réservés
          au personnel du LSPD
        </p>
      </div>

      <form method="GET" className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-mist-500" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Rechercher dans les procédures…"
            className="w-full rounded-lg border border-ink-600 bg-ink-850 py-2.5 pr-3.5 pl-10 text-sm text-mist-100 placeholder:text-mist-500/70 focus:border-badge-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-mist-100 transition-colors hover:bg-ink-700"
        >
          Rechercher
        </button>
      </form>

      {texts.length === 0 ? (
        <Panel>
          <EmptyState
            title={query ? "Aucun résultat" : "Aucune procédure enregistrée"}
            description={
              query
                ? "Aucune fiche ne mentionne ce terme."
                : "Les fiches circulaires du département apparaîtront ici."
            }
          />
        </Panel>
      ) : (
        <>
          {query ? (
            <p className="text-sm text-mist-500">
              {texts.length} fiche(s) mentionnant « {query} »
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {texts.map((t) => (
              <Link
                key={t.id}
                href={`/procedures/${encodeURIComponent(t.code)}`}
                className="group rounded-xl border border-ink-700 bg-ink-900/80 p-5 transition-colors hover:border-badge-500/50 hover:bg-ink-800/60"
              >
                <div className="flex items-start gap-3">
                  <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-badge-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-mist-100">
                      {t.title}
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-mist-500">
                      {excerpt(t.content)}
                    </p>
                    {t.notes ? (
                      <Badge tone="amber" className="mt-3">
                        Comporte une note
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
