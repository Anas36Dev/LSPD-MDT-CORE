import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
} from "lucide-react";

import { Badge, EmptyState, Panel } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Casiers Judiciaires" };

const PAGE_SIZE = 15;

export default async function CasiersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireModule("civilians");
  const { q, page: pageParam } = await searchParams;
  const query = (q ?? "").trim();
  const page = Math.max(1, Number(pageParam) || 1);

  const where = query
    ? {
        OR: [
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { reference: { contains: query } },
        ],
      }
    : {};

  const [total, civilians] = await Promise.all([
    db.civilian.count({ where }),
    db.civilian.findMany({
      where,
      orderBy: query ? { lastName: "asc" } : { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { criminalRecords: true, warrants: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/casiers-judiciaires?${qs}` : "/casiers-judiciaires";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">
            Casiers Judiciaires
          </h1>
          <p className="mt-1 text-sm text-mist-500">
            Registre des individus et de leurs antécédents judiciaires
          </p>
        </div>

        <Link
          href="/casiers-judiciaires/new"
          className="inline-flex items-center gap-2 rounded-lg border border-badge-500/60 bg-badge-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-badge-500"
        >
          <UserPlus className="h-4 w-4" />
          Nouveau casier
        </Link>
      </div>

      <form method="GET" className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-mist-500" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Nom, prénom ou référence (CASIER-…)"
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

      <Panel>
        <div className="flex items-center justify-between gap-4 border-b border-ink-700 bg-ink-850/40 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Fingerprint className="h-4 w-4 text-badge-300" />
            <h2 className="text-xs font-semibold tracking-wider text-mist-300 uppercase">
              {query ? "Résultats de recherche" : "Casiers judiciaires"}
            </h2>
          </div>
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-mist-100">{total}</span>
            <span className="text-xs text-mist-500">
              {query ? `pour « ${query} »` : "casier(s)"}
            </span>
          </span>
        </div>
        {civilians.length === 0 ? (
          <EmptyState
            title={query ? "Aucun casier trouvé" : "Registre vide"}
            description={
              query
                ? "Aucun individu ne correspond à cette recherche."
                : "Créez le premier casier judiciaire du département."
            }
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {civilians.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/casiers-judiciaires/${c.id}`}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-ink-800/60"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink-600 bg-ink-850">
                    {c.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.photoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-mist-500">
                        {(c.firstName[0] ?? "") + (c.lastName[0] ?? "")}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-mist-100">
                        {c.firstName} {c.lastName}
                      </p>
                      <span className="font-mono text-[0.68rem] text-badge-300">
                        {c.reference}
                      </span>
                      {c.isFlagged ? (
                        <Badge tone="red">
                          <TriangleAlert className="h-3 w-3" />
                          Dangereux
                        </Badge>
                      ) : null}
                      {c.validatedAt ? (
                        <Badge tone="green">
                          <ShieldCheck className="h-3 w-3" />
                          Validé
                        </Badge>
                      ) : (
                        <Badge tone="amber">En attente</Badge>
                      )}
                    </div>
                    <p className="text-xs text-mist-500">
                      {c.dateOfBirth
                        ? `Né(e) le ${formatDate(c.dateOfBirth)}`
                        : "Date de naissance inconnue"}
                      {c.nationality ? ` · ${c.nationality}` : ""}
                    </p>
                  </div>

                  {c._count.warrants > 0 ? (
                    <Badge tone="red">{c._count.warrants} mandat(s)</Badge>
                  ) : null}
                  {c._count.criminalRecords > 0 ? (
                    <Badge tone="amber">
                      {c._count.criminalRecords} infraction(s)
                    </Badge>
                  ) : (
                    <Badge tone="green">Casier vierge</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {total > 0 ? (
          <div className="flex items-center justify-between gap-4 border-t border-ink-700 px-5 py-3">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-mist-100 transition-colors hover:bg-ink-700"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Précédent
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-ink-700/60 px-3 py-1.5 text-xs text-mist-600">
                <ChevronLeft className="h-3.5 w-3.5" />
                Précédent
              </span>
            )}

            <p className="text-xs text-mist-500">
              Page <span className="font-medium text-mist-100">{page}</span> sur{" "}
              <span className="font-medium text-mist-100">{totalPages}</span>
            </p>

            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-mist-100 transition-colors hover:bg-ink-700"
              >
                Suivant
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-ink-700/60 px-3 py-1.5 text-xs text-mist-600">
                Suivant
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
