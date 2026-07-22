import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Fingerprint, User, X } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { formatDateTime } from "@/lib/utils";
import { FACTION_STATUS } from "../page";
import {
  FactionNoteForm,
  LinkCivilianForm,
  LinkInvestigationForm,
  LinkReportForm,
} from "../forms";
import {
  deleteFaction,
  unlinkCivilian,
  unlinkInvestigation,
  unlinkReport,
  updateFactionStatus,
} from "../actions";

export const metadata: Metadata = { title: "Groupuscule" };

const STATUS_ACTIONS = [
  { value: "ACTIVE", label: "Marquer actif" },
  { value: "WATCHED", label: "Mettre sous surveillance" },
  { value: "DISMANTLED", label: "Démanteler" },
];

export default async function FactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("factions");
  const { id } = await params;
  const factionId = Number(id);
  if (!Number.isInteger(factionId)) notFound();

  const faction = await db.faction.findUnique({
    where: { id: factionId },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { firstName: true, lastName: true } } },
      },
      reports: {
        include: {
          report: { select: { id: true, reference: true, title: true } },
        },
      },
      investigations: {
        include: {
          investigation: {
            select: { id: true, reference: true, title: true },
          },
        },
      },
      civilians: {
        include: {
          civilian: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!faction) notFound();

  const linkedReportIds = faction.reports.map((r) => r.reportId);
  const linkedInvIds = faction.investigations.map((i) => i.investigationId);
  const linkedCivIds = faction.civilians.map((c) => c.civilianId);

  const [reportOpts, invOpts, civOpts] = await Promise.all([
    db.report.findMany({
      where: linkedReportIds.length ? { id: { notIn: linkedReportIds } } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, reference: true, title: true },
    }),
    db.investigation.findMany({
      where: linkedInvIds.length ? { id: { notIn: linkedInvIds } } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, reference: true, title: true },
    }),
    db.civilian.findMany({
      where: linkedCivIds.length ? { id: { notIn: linkedCivIds } } : {},
      orderBy: { lastName: "asc" },
      take: 200,
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const s = FACTION_STATUS[faction.status] ?? FACTION_STATUS.ACTIVE;

  return (
    <div className="space-y-6">
      <Link
        href="/factions"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux groupuscules
      </Link>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold text-mist-100">
                {faction.name}
              </h1>
              <Badge tone={s.tone}>{s.label}</Badge>
            </div>
            <p className="mt-1 text-xs text-mist-500">
              {faction.createdBy
                ? `Recensé par ${faction.createdBy.firstName} ${faction.createdBy.lastName}`
                : "Recensé"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_ACTIONS.filter((a) => a.value !== faction.status).map((a) => (
              <form key={a.value} action={updateFactionStatus}>
                <input type="hidden" name="factionId" value={faction.id} />
                <input type="hidden" name="status" value={a.value} />
                <button
                  type="submit"
                  className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-300 transition-colors hover:bg-ink-700 hover:text-mist-100"
                >
                  {a.label}
                </button>
              </form>
            ))}
            <form action={deleteFaction}>
              <input type="hidden" name="factionId" value={faction.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md border border-alert-500/50 px-2.5 py-1 text-xs text-alert-500 transition-colors hover:bg-alert-600/15"
              >
                <X className="h-3.5 w-3.5" />
                Supprimer
              </button>
            </form>
          </div>
        </div>
        <div className="border-t border-ink-700 px-6 py-4">
          <p className="text-sm leading-relaxed whitespace-pre-line text-mist-300">
            {faction.description}
          </p>
        </div>
      </Panel>

      {/* --- Civils rattachés ---------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Civils rattachés"
          subtitle={`${faction.civilians.length} membre(s) recensé(s)`}
        />
        {faction.civilians.length === 0 ? (
          <EmptyState
            title="Aucun civil"
            description="Rattachez les civils recensés appartenant à ce groupe."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {faction.civilians.map((c) => (
              <li
                key={c.civilianId}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
              >
                <User className="h-4 w-4 shrink-0 text-mist-500" />
                <Link
                  href={`/casiers-judiciaires/${c.civilian.id}`}
                  className="text-sm text-mist-100 hover:text-badge-300"
                >
                  {c.civilian.firstName} {c.civilian.lastName}
                </Link>
                {c.role ? <Badge tone="neutral">{c.role}</Badge> : null}
                <form action={unlinkCivilian} className="ml-auto">
                  <input type="hidden" name="factionId" value={faction.id} />
                  <input type="hidden" name="civilianId" value={c.civilianId} />
                  <button
                    type="submit"
                    title="Détacher"
                    className="rounded p-1 text-mist-500 transition-colors hover:text-alert-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <LinkCivilianForm
          factionId={faction.id}
          options={civOpts.map((c) => ({
            id: c.id,
            label: `${c.firstName} ${c.lastName}`,
          }))}
        />
      </Panel>

      {/* --- Enquêtes rattachées ------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Enquêtes rattachées"
          subtitle={`${faction.investigations.length} enquête(s)`}
        />
        {faction.investigations.length === 0 ? (
          <EmptyState title="Aucune enquête" description="Rattachez les enquêtes liées." />
        ) : (
          <ul className="divide-y divide-ink-700">
            {faction.investigations.map((i) => (
              <li
                key={i.investigationId}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
              >
                <Fingerprint className="h-4 w-4 shrink-0 text-mist-500" />
                <Link
                  href={`/investigations/${i.investigation.id}`}
                  className="font-mono text-xs text-badge-300 hover:underline"
                >
                  {i.investigation.reference}
                </Link>
                <span className="min-w-0 flex-1 truncate text-sm text-mist-100">
                  {i.investigation.title}
                </span>
                <form action={unlinkInvestigation}>
                  <input type="hidden" name="factionId" value={faction.id} />
                  <input
                    type="hidden"
                    name="investigationId"
                    value={i.investigationId}
                  />
                  <button
                    type="submit"
                    title="Détacher"
                    className="rounded p-1 text-mist-500 transition-colors hover:text-alert-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <LinkInvestigationForm
          factionId={faction.id}
          options={invOpts.map((i) => ({
            id: i.id,
            label: `${i.reference} — ${i.title}`,
          }))}
        />
      </Panel>

      {/* --- Rapports rattachés -------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Rapports rattachés"
          subtitle={`${faction.reports.length} rapport(s)`}
        />
        {faction.reports.length === 0 ? (
          <EmptyState title="Aucun rapport" description="Rattachez les rapports liés." />
        ) : (
          <ul className="divide-y divide-ink-700">
            {faction.reports.map((r) => (
              <li
                key={r.reportId}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
              >
                <FileText className="h-4 w-4 shrink-0 text-mist-500" />
                <Link
                  href={`/reports/${r.report.id}`}
                  className="font-mono text-xs text-badge-300 hover:underline"
                >
                  {r.report.reference}
                </Link>
                <span className="min-w-0 flex-1 truncate text-sm text-mist-100">
                  {r.report.title}
                </span>
                <form action={unlinkReport}>
                  <input type="hidden" name="factionId" value={faction.id} />
                  <input type="hidden" name="reportId" value={r.reportId} />
                  <button
                    type="submit"
                    title="Détacher"
                    className="rounded p-1 text-mist-500 transition-colors hover:text-alert-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <LinkReportForm
          factionId={faction.id}
          options={reportOpts.map((r) => ({
            id: r.id,
            label: `${r.reference} — ${r.title}`,
          }))}
        />
      </Panel>

      {/* --- Journal ------------------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Journal du groupe"
          subtitle={`${faction.notes.length} entrée(s)`}
        />
        {faction.notes.length === 0 ? (
          <EmptyState title="Journal vide" description="Consignez les éléments sur ce groupe." />
        ) : (
          <ul className="divide-y divide-ink-700">
            {faction.notes.map((n) => (
              <li key={n.id} className="px-5 py-3">
                <p className="text-sm whitespace-pre-line text-mist-100">
                  {n.body}
                </p>
                <p className="mt-1 text-xs text-mist-500">
                  {n.author.firstName} {n.author.lastName} ·{" "}
                  {formatDateTime(n.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <FactionNoteForm factionId={faction.id} />
      </Panel>
    </div>
  );
}
