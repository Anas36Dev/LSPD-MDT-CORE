import type { Metadata } from "next";
import { CalendarClock, MapPin } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { formatDateTime } from "@/lib/utils";
import { cancelConvocation } from "./actions";
import { ConvocationForm } from "./forms";

export const metadata: Metadata = { title: "Convocations" };

const STATUS: Record<string, { label: string; tone: "amber" | "green" | "neutral" }> = {
  PENDING: { label: "En attente", tone: "amber" },
  ACKNOWLEDGED: { label: "Vue par l'agent", tone: "green" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
};

export default async function ConvocationsPage() {
  const user = await requireModule("convocations");

  const [agents, convocations] = await Promise.all([
    db.user.findMany({
      where: { id: { not: user.id } },
      orderBy: [{ rank: { level: "desc" } }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        badgeNumber: true,
        rank: { select: { name: true } },
      },
    }),
    db.convocation.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        agent: {
          select: { firstName: true, lastName: true, badgeNumber: true },
        },
        summonedBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const agentOptions = agents.map((a) => ({
    id: a.id,
    label: `${a.rank.name} ${a.firstName} ${a.lastName} #${a.badgeNumber}`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">Convocations</h1>
        <p className="mt-1 text-sm text-mist-500">
          Convoquer un agent dans un bureau ou un lieu précis. L&apos;agent est
          notifié et la convocation est épinglée sur son tableau de bord.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="self-start lg:col-span-1">
          <PanelHeader
            title="Nouvelle convocation"
            subtitle="Réservé au Command Staff / superviseurs"
          />
          <ConvocationForm agents={agentOptions} />
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Convocations émises"
            action={<Badge tone="neutral">{convocations.length}</Badge>}
          />
          {convocations.length === 0 ? (
            <EmptyState
              title="Aucune convocation"
              description="Les convocations émises apparaîtront ici."
            />
          ) : (
            <ul className="divide-y divide-ink-700">
              {convocations.map((c) => {
                const s = STATUS[c.status] ?? STATUS.PENDING;
                return (
                  <li key={c.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-mist-100">
                        {c.agent.firstName} {c.agent.lastName} #
                        {c.agent.badgeNumber}
                      </span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                      <Badge tone="neutral">
                        <MapPin className="h-3 w-3" />
                        {c.location}
                      </Badge>
                      {c.scheduledAt ? (
                        <Badge tone="blue">
                          <CalendarClock className="h-3 w-3" />
                          {formatDateTime(c.scheduledAt)}
                        </Badge>
                      ) : null}
                      {c.status === "PENDING" ? (
                        <form action={cancelConvocation} className="ml-auto">
                          <input type="hidden" name="id" value={c.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-500 transition-colors hover:border-alert-500/50 hover:text-alert-500"
                          >
                            Annuler
                          </button>
                        </form>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-mist-300">
                      {c.reason}
                    </p>
                    <p className="mt-1 text-[0.68rem] text-mist-500">
                      Émise par {c.summonedBy.firstName} {c.summonedBy.lastName} ·{" "}
                      {formatDateTime(c.createdAt)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
