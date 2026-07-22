import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  Check,
  FileText,
  MapPin,
  Megaphone,
  Pin,
  Siren,
} from "lucide-react";

import { DefconBanner } from "@/components/defcon";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { acknowledgeConvocation } from "../convocations/actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import {
  isAcademyTrainee,
  isCommandStaff,
  isDoj,
  primaryDivision,
  RANK,
  visibleModules,
  yearsOfService,
} from "@/lib/permissions";
import { dutyStatus } from "@/lib/duty";
import { formatDate } from "@/lib/utils";
import { MeetingRecap } from "../meetings/meeting-card";
import { DefconForm } from "./defcon-form";
import { DutyPanel } from "./duty";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  const { denied } = await searchParams;

  const [profile, defcon, announcements, myReports, activeWarrants] =
    await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { recruitedAt: true },
    }),
    db.departmentStatus.findUnique({
      where: { id: 1 },
      include: {
        updatedBy: {
          select: {
            firstName: true,
            lastName: true,
            rank: { select: { name: true } },
          },
        },
      },
    }),
    db.announcement.findMany({
      where: isAcademyTrainee(user) ? { visibleToAcademy: true } : {},
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 5,
      include: { author: { select: { firstName: true, lastName: true } } },
    }),
    isAcademyTrainee(user)
      ? []
      : db.report.findMany({
          where: { authorId: user.id },
          orderBy: { updatedAt: "desc" },
          take: 5,
          include: { template: { select: { name: true } } },
        }),
    isAcademyTrainee(user)
      ? 0
      : db.warrant.count({ where: { status: "ACTIVE" } }),
  ]);

  const modules = visibleModules(user);
  const division = primaryDivision(user);
  // Le Department of Justice, extérieur au LSPD, n'a pas de prise de service.
  const duty = isDoj(user) ? null : await dutyStatus(user.id);

  // Dernier récapitulatif de réunion, visible par tous les agents.
  const latestMeeting = await db.weeklyMeeting.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      gradeChanges: true,
      events: true,
    },
  });

  // Convocations en attente : épinglées en haut du tableau de bord.
  const convocations = await db.convocation.findMany({
    where: { agentId: user.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      summonedBy: {
        select: {
          firstName: true,
          lastName: true,
          rank: { select: { name: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">
            Bienvenue, {user.rank.name} {user.lastName}
          </h1>
          <p className="mt-1 text-sm text-mist-500">
            Badge #{user.badgeNumber} ·{" "}
            {division
              ? division.name
              : isAcademyTrainee(user)
                ? "Académie de Police"
                : user.rank.level >= RANK.CHIEF_OF_POLICE
                  ? "Chef du département"
                  : "Sans affectation"}{" "}
            · {yearsOfService(profile.recruitedAt)} an(s) de service
          </p>
        </div>

        {duty ? (
          <DutyPanel onDuty={duty.onDuty} todaySeconds={duty.todaySeconds} />
        ) : null}
      </div>

      {/* --- Convocations épinglées : impossibles à manquer ---------------- */}
      {convocations.length > 0 ? (
        <div className="space-y-3">
          {convocations.map((c) => (
            <Panel
              key={c.id}
              className="border-gold-500/40 bg-gold-600/[0.07]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="gold">
                      <Pin className="h-3 w-3" />
                      Convocation
                    </Badge>
                    <Badge tone="neutral">
                      <MapPin className="h-3 w-3" />
                      {c.location}
                    </Badge>
                    {c.scheduledAt ? (
                      <Badge tone="blue">
                        <CalendarClock className="h-3 w-3" />
                        {formatDate(c.scheduledAt)}{" "}
                        {new Intl.DateTimeFormat("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(c.scheduledAt)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-mist-100">
                    {c.reason}
                  </p>
                  <p className="mt-1.5 text-xs text-mist-500">
                    Convoqué par {c.summonedBy.rank.name}{" "}
                    {c.summonedBy.firstName} {c.summonedBy.lastName}
                  </p>
                </div>
                <form action={acknowledgeConvocation}>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gold-500/50 bg-gold-600/15 px-3.5 py-2 text-xs font-medium text-gold-300 transition-colors hover:bg-gold-600/25"
                  >
                    <Check className="h-4 w-4" />
                    J&apos;ai pris connaissance
                  </button>
                </form>
              </div>
            </Panel>
          ))}
        </div>
      ) : null}

      {/* --- Niveau DEFCON : visible de tous, dès l'ouverture du terminal -- */}
      <div className="space-y-3">
        <DefconBanner
          level={defcon?.defconLevel ?? 5}
          reason={defcon?.defconReason}
          setBy={
            defcon?.updatedBy
              ? `${defcon.updatedBy.rank.name} ${defcon.updatedBy.firstName} ${defcon.updatedBy.lastName}`
              : null
          }
        />

        {isCommandStaff(user) ? (
          <div className="flex flex-wrap items-start gap-3">
            <DefconForm current={defcon?.defconLevel ?? 5} />
          </div>
        ) : null}
      </div>

      {denied ? (
        <p
          role="alert"
          className="rounded-lg border border-warn-500/40 bg-warn-500/10 px-4 py-3 text-sm text-warn-500"
        >
          Accès refusé : votre grade et vos affectations ne vous donnent pas
          accès à ce module.
        </p>
      ) : null}

      {isAcademyTrainee(user) ? (
        <Panel className="border-gold-500/30 bg-gold-600/5">
          <div className="px-5 py-4">
            <p className="text-sm font-medium text-gold-400">
              Statut : {user.rank.name}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-mist-300">
              Vous êtes en formation à l&apos;académie de police. Seuls les
              modules de l&apos;académie et les codes radio vous sont
              accessibles. Vos instructeurs valideront votre sortie de
              formation.
            </p>
          </div>
        </Panel>
      ) : null}

      {/* Le Department of Justice ne voit que le niveau DEFCON : ni statistiques,
          ni annonces, ni rapports. Il est extérieur au LSPD. */}
      {isDoj(user) ? null : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Modules accessibles"
          value={modules.length}
          icon={<BookOpen className="h-5 w-5" />}
        />
        <StatTile
          label="Mes rapports"
          value={Array.isArray(myReports) ? myReports.length : 0}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatTile
          label="Mandats actifs"
          value={activeWarrants}
          icon={<Siren className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-badge-300" />
                Annonces du département
              </span>
            }
            subtitle="Communications officielles"
          />
          {announcements.length === 0 ? (
            <EmptyState
              title="Aucune annonce"
              description="Les communications du Command Staff apparaîtront ici."
            />
          ) : (
            <ul className="divide-y divide-ink-700">
              {announcements.map((a) => (
                <li key={a.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-mist-100">
                      {a.title}
                    </p>
                    {a.priority !== "NORMAL" ? (
                      <Badge tone={a.priority === "URGENT" ? "red" : "amber"}>
                        {a.priority}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-mist-300">
                    {a.body}
                  </p>
                  <p className="mt-2 text-[0.68rem] text-mist-500">
                    {a.author.firstName} {a.author.lastName} ·{" "}
                    {formatDate(a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4 text-badge-300" />
                Mes rapports récents
              </span>
            }
            subtitle="Brouillons et soumissions"
          />
          {!Array.isArray(myReports) || myReports.length === 0 ? (
            <EmptyState
              title="Aucun rapport"
              description={
                isAcademyTrainee(user)
                  ? "La rédaction de rapports est réservée aux agents assermentés."
                  : "Vos rapports rédigés apparaîtront ici."
              }
            />
          ) : (
            <ul className="divide-y divide-ink-700">
              {myReports.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/reports/${r.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-ink-800/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-mist-100">{r.title}</p>
                      <p className="text-xs text-mist-500">
                        {r.template.name} · {r.reference}
                      </p>
                    </div>
                    <ReportStatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
          </div>

          {/* --- Récapitulatif de réunion : encadré bleu, à droite --------- */}
          <div className="lg:col-span-1">
            {latestMeeting ? (
              <MeetingRecap
                variant="blue"
                compact
                meeting={{
                  id: latestMeeting.id,
                  summary: latestMeeting.summary,
                  meetingDate: latestMeeting.meetingDate,
                  signature: latestMeeting.signature,
                  createdAt: latestMeeting.createdAt,
                  createdByName: `${latestMeeting.createdBy.firstName} ${latestMeeting.createdBy.lastName}`,
                  gradeChanges: latestMeeting.gradeChanges,
                  events: latestMeeting.events,
                }}
              />
            ) : (
              <Panel className="border-badge-500/40 bg-badge-600/[0.05]">
                <div className="px-5 py-10 text-center text-sm text-mist-500">
                  Aucun récapitulatif récemment publié.
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <Panel className="flex items-center gap-4 px-5 py-4">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 text-badge-300">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="label-tag">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-mist-100">{value}</p>
      </div>
    </Panel>
  );
}

const STATUS_LABELS: Record<string, { label: string; tone: "neutral" | "blue" | "green" | "red" | "amber" }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  SUBMITTED: { label: "Soumis", tone: "blue" },
  APPROVED: { label: "Validé", tone: "green" },
  REJECTED: { label: "Refusé", tone: "red" },
  CHANGES_REQUESTED: { label: "À corriger", tone: "amber" },
};

export function ReportStatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? STATUS_LABELS.DRAFT;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
