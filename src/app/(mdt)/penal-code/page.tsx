import type { Metadata } from "next";
import { Scale, Search } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import {
  PENAL_CATEGORIES,
  PENAL_CATEGORY_LABELS,
  PENAL_CATEGORY_TONES,
} from "@/lib/report-schema";

export const metadata: Metadata = { title: "Code pénal" };

export default async function PenalCodePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; doj?: string }>;
}) {
  const user = await requireModule("penal-code");
  const { q, cat, doj } = await searchParams;

  const query = (q ?? "").trim();
  const isDoj = user.isSuperAdmin || user.rank.code === "DOJ";

  const articles = await db.penalCode.findMany({
    where: {
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { code: { contains: query } },
              { description: { contains: query } },
            ],
          }
        : {}),
      ...(cat ? { category: cat } : {}),
      ...(doj === "1" ? { requiresDoj: true } : {}),
    },
    orderBy: { order: "asc" },
  });

  const counts = await db.penalCode.groupBy({
    by: ["category"],
    _count: true,
  });
  const countOf = (c: string) =>
    counts.find((x) => x.category === c)?._count ?? 0;

  const total = counts.reduce((s, c) => s + c._count, 0);
  const money = (n: number) => `${n.toLocaleString("fr-FR")} $`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">Code pénal</h1>
          <p className="mt-1 text-sm text-mist-500">
            État de San Andreas · {total} articles
          </p>
        </div>

        {isDoj ? (
          <Badge tone="gold">
            <Scale className="h-3 w-3" />
            Accréditation Department of Justice
          </Badge>
        ) : null}
      </div>

      <Panel className="px-5 py-4">
        <p className="text-xs leading-relaxed text-mist-300">
          Le présent code pénal fixe l&apos;ensemble des règles relatives aux
          infractions et aux peines applicables sur le territoire de
          l&apos;État de San Andreas. Il a pour objet d&apos;assurer la
          protection de la société, le respect de l&apos;ordre public et la
          garantie des droits fondamentaux de chaque citoyen.
        </p>
      </Panel>

      {/* Recherche et filtres en GET : l'URL reste partageable entre agents. */}
      <form method="GET" className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-mist-500" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Rechercher un article, une infraction…"
              className="w-full rounded-lg border border-ink-600 bg-ink-850 py-2.5 pr-3.5 pl-10 text-sm text-mist-100 placeholder:text-mist-500/70 focus:border-badge-500 focus:outline-none"
            />
          </div>
          {cat ? <input type="hidden" name="cat" value={cat} /> : null}
          {doj ? <input type="hidden" name="doj" value={doj} /> : null}
          <button
            type="submit"
            className="rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-mist-100 transition-colors hover:bg-ink-700"
          >
            Rechercher
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-1.5">
        <FilterLink label={`Tout (${total})`} active={!cat && doj !== "1"} q={query} />
        {PENAL_CATEGORIES.map((c) => (
          <FilterLink
            key={c}
            label={`${PENAL_CATEGORY_LABELS[c]} (${countOf(c)})`}
            active={cat === c}
            q={query}
            cat={c}
          />
        ))}
        <FilterLink label="Articles DOJ" active={doj === "1"} q={query} doj />
      </div>

      <Panel>
        <PanelHeader
          title={
            cat
              ? PENAL_CATEGORY_LABELS[cat]
              : doj === "1"
                ? "Articles relevant du Department of Justice"
                : "Tous les articles"
          }
          subtitle={`${articles.length} article(s)`}
        />

        {articles.length === 0 ? (
          <EmptyState
            title="Aucun article"
            description="Aucun article ne correspond à cette recherche."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left">
                  <Th>Article</Th>
                  <Th>Infraction</Th>
                  <Th>Catégorie</Th>
                  <Th>DOJ</Th>
                  <Th className="text-right">Amende max.</Th>
                  <Th className="text-right">Détention</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {articles.map((p) => (
                  <tr key={p.id} className="align-top hover:bg-ink-800/50">
                    <td className="px-5 py-2.5 font-mono whitespace-nowrap text-badge-300">
                      {p.code}
                    </td>
                    <td className="px-5 py-2.5 text-mist-100">
                      {p.title}
                      {p.description ? (
                        <span className="mt-0.5 block text-xs leading-relaxed text-mist-500">
                          {p.description}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-2.5">
                      <Badge
                        tone={PENAL_CATEGORY_TONES[p.category] ?? "neutral"}
                      >
                        {PENAL_CATEGORY_LABELS[p.category] ?? p.category}
                      </Badge>
                    </td>
                    <td className="px-5 py-2.5">
                      {p.requiresDoj ? (
                        <Badge tone="gold">DOJ</Badge>
                      ) : p.dojOnCumulation ? (
                        <Badge tone="neutral">Si cumul</Badge>
                      ) : null}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap text-mist-300">
                      {p.fine != null ? money(p.fine) : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap text-mist-300">
                      {p.isLifeSentence ? (
                        <span className="font-medium text-alert-500">
                          Perpétuité
                        </span>
                      ) : p.jailTime ? (
                        `${p.jailTime} min`
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="border-t border-ink-700 px-5 py-3 text-xs leading-relaxed text-mist-500">
          Les amendes sont cumulables, les peines de détention ne le sont pas :
          c&apos;est toujours la plus longue qui prime. Un article marqué DOJ
          relève du Department of Justice ; « si cumul » signifie que le renvoi
          au juge n&apos;intervient qu&apos;en cas de cumul avec un délit
          supérieur.
        </p>
      </Panel>
    </div>
  );
}

function FilterLink({
  label,
  active,
  q,
  cat,
  doj,
}: {
  label: string;
  active: boolean;
  q: string;
  cat?: string;
  doj?: boolean;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (cat) params.set("cat", cat);
  if (doj) params.set("doj", "1");

  const href = params.toString() ? `/penal-code?${params}` : "/penal-code";

  return (
    <a
      href={href}
      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-badge-500/50 bg-badge-600/20 text-badge-300"
          : "border-ink-600 text-mist-500 hover:text-mist-100"
      }`}
    >
      {label}
    </a>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`label-tag px-5 py-2.5 font-semibold ${className ?? ""}`}>
      {children}
    </th>
  );
}
