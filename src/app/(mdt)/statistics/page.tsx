import type { Metadata } from "next";

import { Badge, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { yearsOfService } from "@/lib/permissions";

export const metadata: Metadata = { title: "Statistiques" };

/**
 * Barre de proportion.
 *
 * Un graphique en CSS pur plutôt qu'une bibliothèque : les volumes affichés
 * sont des comptages simples, et cela évite d'embarquer du JavaScript client
 * sur une page de consultation.
 */
function Bar({
  label,
  value,
  max,
  tone = "badge",
}: {
  label: string;
  value: number;
  max: number;
  tone?: "badge" | "gold" | "alert";
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const colors = {
    badge: "bg-badge-500",
    gold: "bg-gold-500",
    alert: "bg-alert-500",
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-mist-300">{label}</span>
        <span className="shrink-0 text-sm font-medium text-mist-100">
          {value}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-800">
        <div
          className={`h-full rounded-full ${colors[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function StatisticsPage() {
  await requireModule("statistics");

  const [
    agents,
    divisions,
    reportsByStatus,
    reportsByTemplate,
    topAuthors,
    warrantCount,
    boloCount,
    civilianCount,
    vehicleCount,
    recordCount,
  ] = await Promise.all([
    db.user.findMany({
      where: { isSuperAdmin: false },
      select: {
        recruitedAt: true,
        status: true,
        rank: { select: { name: true, level: true, category: true } },
      },
    }),
    db.division.findMany({
      orderBy: { order: "asc" },
      select: {
        name: true,
        _count: { select: { members: true } },
      },
    }),
    db.report.groupBy({ by: ["status"], _count: true }),
    db.report.groupBy({ by: ["templateId"], _count: true }),
    db.report.groupBy({
      by: ["authorId"],
      _count: true,
      orderBy: { _count: { authorId: "desc" } },
      take: 8,
    }),
    db.warrant.count({ where: { status: "ACTIVE" } }),
    db.bolo.count({ where: { status: "ACTIVE" } }),
    db.civilian.count(),
    db.vehicle.count(),
    db.criminalRecord.count(),
  ]);

  const [templates, authors] = await Promise.all([
    db.reportTemplate.findMany({ select: { id: true, name: true } }),
    db.user.findMany({
      where: { id: { in: topAuthors.map((a) => a.authorId) } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        badgeNumber: true,
      },
    }),
  ]);

  // --- Agrégats calculés en mémoire : les volumes restent petits ----------
  const byCategory = new Map<string, number>();
  const byRank = new Map<string, number>();
  for (const a of agents) {
    byCategory.set(a.rank.category, (byCategory.get(a.rank.category) ?? 0) + 1);
    byRank.set(a.rank.name, (byRank.get(a.rank.name) ?? 0) + 1);
  }

  const active = agents.filter((a) => a.status === "ACTIVE").length;
  const loa = agents.filter((a) => a.status === "ADMIN_LEAVE").length;
  const suspended = agents.filter((a) => a.status === "SUSPENDED").length;

  const totalService = agents.reduce(
    (sum, a) => sum + yearsOfService(a.recruitedAt),
    0,
  );
  const avgService =
    agents.length > 0 ? (totalService / agents.length).toFixed(1) : "0";

  const totalReports = reportsByStatus.reduce((s, r) => s + r._count, 0);
  const maxDivision = Math.max(1, ...divisions.map((d) => d._count.members));
  const maxRank = Math.max(1, ...[...byRank.values()]);

  const CATEGORY_LABELS: Record<string, string> = {
    CHIEF_OFFICE: "Chief Office",
    COMMAND_STAFF: "Command Staff",
    SUPERVISOR_STAFF: "Supervisor Staff",
    DETECTIVE_STAFF: "Detective Staff",
    EXECUTIVE_STAFF: "Executive Staff",
    PROBATIONARY: "Probationary Officer",
    ACADEMY: "Recrue Académique",
    DOJ: "Department of Justice",
  };

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: "Brouillons",
    SUBMITTED: "En validation",
    APPROVED: "Validés",
    REJECTED: "Refusés",
    CHANGES_REQUESTED: "À corriger",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">Statistiques</h1>
        <p className="mt-1 text-sm text-mist-500">
          Activité et composition du département
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Effectif total" value={agents.length} />
        <Tile label="En service actif" value={active} />
        <Tile label="Ancienneté moyenne" value={`${avgService} ans`} />
        <Tile label="Rapports rédigés" value={totalReports} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Fiches civiles" value={civilianCount} />
        <Tile label="Véhicules fichés" value={vehicleCount} />
        <Tile label="Mandats actifs" value={warrantCount} tone="alert" />
        <Tile label="Avis de recherche" value={boloCount} tone="alert" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Répartition par division"
            subtitle="Un agent peut appartenir à plusieurs divisions"
          />
          <div className="space-y-3.5 px-5 py-4">
            {divisions.map((d) => (
              <Bar
                key={d.name}
                label={d.name}
                value={d._count.members}
                max={maxDivision}
              />
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Répartition par grade" />
          <div className="space-y-3.5 px-5 py-4">
            {[...byRank.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => (
                <Bar key={name} label={name} value={count} max={maxRank} tone="gold" />
              ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Par catégorie hiérarchique" />
          <ul className="divide-y divide-ink-700">
            {[...byCategory.entries()].map(([cat, count]) => (
              <li
                key={cat}
                className="flex items-center justify-between px-5 py-2.5"
              >
                <span className="text-sm text-mist-300">
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
                <span className="text-sm font-medium text-mist-100">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Statut des comptes" />
          <ul className="divide-y divide-ink-700">
            <StatusRow label="Actifs" value={active} tone="green" />
            <StatusRow
              label="En congé administratif"
              value={loa}
              tone="amber"
            />
            <StatusRow label="Suspendus" value={suspended} tone="red" />
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Casiers judiciaires" />
          <div className="px-5 py-4">
            <p className="text-3xl font-semibold text-mist-100">
              {recordCount}
            </p>
            <p className="mt-1 text-xs text-mist-500">
              condamnations enregistrées sur {civilianCount} fiche(s) civile(s)
            </p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Rapports par statut" />
          {reportsByStatus.length === 0 ? (
            <p className="px-5 py-4 text-sm text-mist-500">
              Aucun rapport rédigé pour l&apos;instant.
            </p>
          ) : (
            <ul className="divide-y divide-ink-700">
              {reportsByStatus.map((r) => (
                <li
                  key={r.status}
                  className="flex items-center justify-between px-5 py-2.5"
                >
                  <span className="text-sm text-mist-300">
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  <span className="text-sm font-medium text-mist-100">
                    {r._count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Agents les plus actifs"
            subtitle="Nombre de rapports rédigés"
          />
          {topAuthors.length === 0 ? (
            <p className="px-5 py-4 text-sm text-mist-500">
              Aucune activité enregistrée.
            </p>
          ) : (
            <ul className="divide-y divide-ink-700">
              {topAuthors.map((a) => {
                const agent = authors.find((x) => x.id === a.authorId);
                return (
                  <li
                    key={a.authorId}
                    className="flex items-center justify-between px-5 py-2.5"
                  >
                    <span className="text-sm text-mist-300">
                      {agent
                        ? `${agent.firstName} ${agent.lastName} #${agent.badgeNumber}`
                        : "Agent supprimé"}
                    </span>
                    <span className="text-sm font-medium text-mist-100">
                      {a._count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {reportsByTemplate.length > 0 ? (
        <Panel>
          <PanelHeader title="Rapports par type" />
          <ul className="divide-y divide-ink-700">
            {reportsByTemplate.map((r) => (
              <li
                key={r.templateId}
                className="flex items-center justify-between px-5 py-2.5"
              >
                <span className="text-sm text-mist-300">
                  {templates.find((t) => t.id === r.templateId)?.name ??
                    "Modèle supprimé"}
                </span>
                <span className="text-sm font-medium text-mist-100">
                  {r._count}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "alert";
}) {
  return (
    <Panel className="px-5 py-4">
      <p className="label-tag">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === "alert" && Number(value) > 0
            ? "text-alert-500"
            : "text-mist-100"
        }`}
      >
        {value}
      </p>
    </Panel>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "red";
}) {
  return (
    <li className="flex items-center justify-between px-5 py-2.5">
      <span className="text-sm text-mist-300">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </li>
  );
}
