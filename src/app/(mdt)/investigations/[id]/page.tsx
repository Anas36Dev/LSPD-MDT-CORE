import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Lock, X } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { isDepartmentHead } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { INV_STATUS } from "../page";
import {
  DeleteInvestigationButton,
  InvestigationInfoForm,
  InvestigationNoteForm,
  LinkReportForm,
} from "../forms";
import {
  deleteInvestigationInfo,
  unlinkReport,
  updateInvestigationStatus,
} from "../actions";

export const metadata: Metadata = { title: "Enquête" };

const STATUS_ACTIONS = [
  { value: "ACTIVE", label: "Passer en cours" },
  { value: "CLOSED", label: "Clôturer" },
  { value: "ARCHIVED", label: "Archiver" },
];

export default async function InvestigationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("investigations");
  const { id } = await params;
  const investigationId = Number(id);
  if (!Number.isInteger(investigationId)) notFound();

  const investigation = await db.investigation.findUnique({
    where: { id: investigationId },
    include: {
      lead: { select: { firstName: true, lastName: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { firstName: true, lastName: true } } },
      },
      infos: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { firstName: true, lastName: true } } },
      },
      reports: {
        include: {
          report: {
            select: {
              id: true,
              reference: true,
              title: true,
              status: true,
            },
          },
        },
      },
    },
  });
  if (!investigation) notFound();

  const linkedIds = investigation.reports.map((r) => r.reportId);
  const candidates = await db.report.findMany({
    where: linkedIds.length ? { id: { notIn: linkedIds } } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, reference: true, title: true },
  });

  const s = INV_STATUS[investigation.status] ?? INV_STATUS.OPEN;
  // Une enquête archivée est gelée : aucun ajout possible. Seul le Chief peut
  // la supprimer définitivement.
  const archived = investigation.status === "ARCHIVED";
  const canDelete = isDepartmentHead(user);

  return (
    <div className="space-y-6">
      <Link
        href="/investigations"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux enquêtes
      </Link>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs text-badge-300">
                {investigation.reference}
              </span>
              <Badge tone={s.tone}>{s.label}</Badge>
            </div>
            <h1 className="mt-1.5 text-xl font-semibold text-mist-100">
              {investigation.title}
            </h1>
            <p className="mt-1 text-xs text-mist-500">
              Responsable : {investigation.lead.firstName}{" "}
              {investigation.lead.lastName}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {STATUS_ACTIONS.filter((a) => a.value !== investigation.status).map(
              (a) => (
                <form key={a.value} action={updateInvestigationStatus}>
                  <input type="hidden" name="investigationId" value={investigation.id} />
                  <input type="hidden" name="status" value={a.value} />
                  <button
                    type="submit"
                    className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-300 transition-colors hover:bg-ink-700 hover:text-mist-100"
                  >
                    {a.label}
                  </button>
                </form>
              ),
            )}
            {canDelete && archived ? (
              <DeleteInvestigationButton investigationId={investigation.id} />
            ) : null}
          </div>
        </div>
        <div className="border-t border-ink-700 px-6 py-4">
          <p className="text-sm leading-relaxed whitespace-pre-line text-mist-300">
            {investigation.summary}
          </p>
        </div>
        {archived ? (
          <div className="flex items-center gap-2 border-t border-ink-700 bg-ink-850/40 px-6 py-3 text-xs text-mist-500">
            <Lock className="h-3.5 w-3.5" />
            Enquête archivée — lecture seule. Plus aucun rapport, information ou
            entrée de journal ne peut y être ajouté.
          </div>
        ) : null}
      </Panel>

      {/* --- Rapports rattachés --------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Rapports rattachés"
          subtitle={`${investigation.reports.length} rapport(s) lié(s) à l'enquête`}
        />
        {investigation.reports.length === 0 ? (
          <EmptyState
            title="Aucun rapport rattaché"
            description="Rattachez les rapports liés à cette enquête ci-dessous."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {investigation.reports.map((link) => (
              <li
                key={link.reportId}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
              >
                <FileText className="h-4 w-4 shrink-0 text-mist-500" />
                <Link
                  href={`/reports/${link.report.id}`}
                  className="font-mono text-xs text-badge-300 hover:underline"
                >
                  {link.report.reference}
                </Link>
                <span className="min-w-0 flex-1 truncate text-sm text-mist-100">
                  {link.report.title}
                </span>
                <Badge tone="neutral">{link.report.status}</Badge>
                {!archived ? (
                  <form action={unlinkReport}>
                    <input type="hidden" name="investigationId" value={investigation.id} />
                    <input type="hidden" name="reportId" value={link.reportId} />
                    <button
                      type="submit"
                      title="Détacher"
                      className="rounded p-1 text-mist-500 transition-colors hover:text-alert-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {!archived ? (
          <LinkReportForm
            investigationId={investigation.id}
            reports={candidates.map((r) => ({
              id: r.id,
              label: `${r.reference} — ${r.title}`,
            }))}
          />
        ) : null}
      </Panel>

      {/* --- Informations & éléments ---------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Informations & éléments"
          subtitle={`${investigation.infos.length} élément(s) rattaché(s)`}
        />
        {investigation.infos.length === 0 ? (
          <EmptyState
            title="Aucune information"
            description="Rattachez suspects, indices, lieux et éléments utiles à l'enquête."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {investigation.infos.map((info) => (
              <li key={info.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge tone="blue">{info.label}</Badge>
                  <span className="ml-auto text-xs text-mist-500">
                    {info.author.firstName} {info.author.lastName} ·{" "}
                    {formatDateTime(info.createdAt)}
                  </span>
                  {!archived ? (
                    <form action={deleteInvestigationInfo}>
                      <input type="hidden" name="infoId" value={info.id} />
                      <button
                        type="submit"
                        title="Supprimer"
                        className="rounded p-1 text-mist-500 transition-colors hover:text-alert-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </form>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm whitespace-pre-line text-mist-300">
                  {info.content}
                </p>
              </li>
            ))}
          </ul>
        )}
        {!archived ? (
          <InvestigationInfoForm investigationId={investigation.id} />
        ) : null}
      </Panel>

      {/* --- Journal d'enquête ---------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Journal d'enquête"
          subtitle={`${investigation.notes.length} entrée(s)`}
        />
        {investigation.notes.length === 0 ? (
          <EmptyState
            title="Journal vide"
            description="Consignez les éléments de l'enquête au fil de l'eau."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {investigation.notes.map((n) => (
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
        {!archived ? (
          <InvestigationNoteForm investigationId={investigation.id} />
        ) : null}
      </Panel>
    </div>
  );
}
