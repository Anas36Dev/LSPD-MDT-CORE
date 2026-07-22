import type { Metadata } from "next";
import Link from "next/link";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { can, DIVISION_MIN_LEVEL, isDepartmentHead } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { withdrawTransfer } from "./actions";
import { ApplyForm, DecisionForm, DeleteTransferButton } from "./forms";

export const metadata: Metadata = { title: "Mutations" };

const STATUS: Record<
  string,
  { label: string; tone: "neutral" | "blue" | "green" | "red" }
> = {
  PENDING: { label: "En instruction", tone: "blue" },
  ACCEPTED: { label: "Acceptée", tone: "green" },
  REJECTED: { label: "Refusée", tone: "red" },
  WITHDRAWN: { label: "Retirée", tone: "neutral" },
};

export default async function TransfersPage() {
  const user = await requireModule("transfers");

  const divisions = await db.division.findMany({
    orderBy: { order: "asc" },
    include: {
      subDivisions: { orderBy: { order: "asc" }, select: { id: true, name: true } },
    },
  });

  // Divisions sur lesquelles l'agent a autorité pour instruire.
  const decidableCodes = divisions
    .filter((d) => can.decideTransfer(user, d.code))
    .map((d) => d.id);

  // Le Chief of Police voit l'intégralité des demandes, tous statuts confondus.
  const seeAll = isDepartmentHead(user);

  const applicantSelect = {
    id: true,
    firstName: true,
    lastName: true,
    badgeNumber: true,
    rank: { select: { name: true } },
  } as const;

  const [mine, toReview, everything] = await Promise.all([
    db.transferRequest.findMany({
      where: { applicantId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    decidableCodes.length > 0
      ? db.transferRequest.findMany({
          where: {
            status: "PENDING",
            divisionId: { in: decidableCodes },
            applicantId: { not: user.id },
          },
          orderBy: { createdAt: "asc" },
          include: { applicant: { select: applicantSelect } },
        })
      : [],
    seeAll
      ? db.transferRequest.findMany({
          orderBy: { createdAt: "desc" },
          take: 200,
          include: { applicant: { select: applicantSelect } },
        })
      : [],
  ]);

  const divisionName = (id: number) =>
    divisions.find((d) => d.id === id)?.name ?? "Division";

  const eligible =
    user.isSuperAdmin || user.rank.level >= DIVISION_MIN_LEVEL;

  // On ne propose pas les divisions dont l'agent est déjà membre.
  const myDivisionIds = user.divisions.map((d) => d.id);
  const available = divisions.filter((d) => !myDivisionIds.includes(d.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Demandes de mutation
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Candidatures vers une division ou une unité du département
        </p>
      </div>

      {toReview.length > 0 ? (
        <Panel className="border-badge-500/40">
          <PanelHeader
            title="Candidatures à instruire"
            subtitle="Divisions dont vous avez la charge"
            action={<Badge tone="blue">{toReview.length}</Badge>}
          />
          <ul className="divide-y divide-ink-700">
            {toReview.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/roster/${r.applicant.id}`}
                    className="text-sm font-medium text-mist-100 hover:text-badge-300"
                  >
                    {r.applicant.rank.name} {r.applicant.firstName}{" "}
                    {r.applicant.lastName}
                  </Link>
                  <span className="text-xs text-mist-500">
                    #{r.applicant.badgeNumber}
                  </span>
                  <Badge tone="blue">{divisionName(r.divisionId)}</Badge>
                  <span className="text-xs text-mist-500">
                    {formatDate(r.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-mist-300">
                  {r.motivation}
                </p>
                <DecisionForm requestId={r.id} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Déposer une candidature"
        />
        <ApplyForm
          divisions={available}
          eligible={eligible}
          rankName={user.rank.name}
        />
      </Panel>

      {seeAll ? (
        <Panel>
          <PanelHeader
            title="Toutes les demandes de mutations"
            action={<Badge tone="neutral">{everything.length}</Badge>}
          />
          {everything.length === 0 ? (
            <EmptyState
              title="Aucune demande"
              description="Aucune demande de mutation n'a encore été déposée."
            />
          ) : (
            <ul className="divide-y divide-ink-700">
              {everything.map((r) => {
                const s = STATUS[r.status] ?? STATUS.PENDING;
                return (
                  <li key={r.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/roster/${r.applicant.id}`}
                        className="text-sm font-medium text-mist-100 hover:text-badge-300"
                      >
                        {r.applicant.rank.name} {r.applicant.firstName}{" "}
                        {r.applicant.lastName}
                      </Link>
                      <span className="text-xs text-mist-500">
                        #{r.applicant.badgeNumber}
                      </span>
                      <Badge tone="blue">{divisionName(r.divisionId)}</Badge>
                      <Badge tone={s.tone}>{s.label}</Badge>
                      <span className="ml-auto text-xs text-mist-500">
                        {formatDate(r.createdAt)}
                      </span>
                      <DeleteTransferButton requestId={r.id} />
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-mist-300">
                      {r.motivation}
                    </p>
                    {r.decisionNote ? (
                      <p className="mt-2 rounded-lg border border-ink-700 bg-ink-850/60 px-3.5 py-2.5 text-xs leading-relaxed text-mist-300">
                        <span className="label-tag">Réponse</span>
                        <br />
                        {r.decisionNote}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Mes candidatures"
          subtitle={`${mine.length} candidature(s)`}
        />
        {mine.length === 0 ? (
          <EmptyState
            title="Aucune candidature"
            description="Vos demandes de mutation apparaîtront ici avec leur suivi."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {mine.map((r) => {
              const s = STATUS[r.status] ?? STATUS.PENDING;
              return (
                <li key={r.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-mist-100">
                      {divisionName(r.divisionId)}
                    </p>
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <span className="text-xs text-mist-500">
                      Déposée le {formatDate(r.createdAt)}
                    </span>

                    {r.status === "PENDING" ? (
                      <form action={withdrawTransfer} className="ml-auto">
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-500 transition-colors hover:text-alert-500"
                        >
                          Retirer
                        </button>
                      </form>
                    ) : null}
                  </div>

                  <p className="mt-1.5 text-sm leading-relaxed text-mist-300">
                    {r.motivation}
                  </p>

                  {r.decisionNote ? (
                    <p className="mt-2 rounded-lg border border-ink-700 bg-ink-850/60 px-3.5 py-2.5 text-xs leading-relaxed text-mist-300">
                      <span className="label-tag">Réponse</span>
                      <br />
                      {r.decisionNote}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
