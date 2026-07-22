import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, LogOut, Skull, TriangleAlert } from "lucide-react";

import { Panel, PanelHeader } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";

export type MeetingCardData = {
  id: number;
  summary: string;
  meetingDate: Date | null;
  signature: string | null;
  createdAt: Date;
  createdByName: string;
  gradeChanges: {
    id: number;
    agentName: string;
    fromRankName: string;
    toRankName: string;
    direction: string;
  }[];
  events: {
    id: number;
    agentName: string;
    rankName: string;
    type: string;
    reason: string | null;
  }[];
};

const EVENT_META: Record<
  string,
  { label: string; icon: typeof TriangleAlert; color: string }
> = {
  WARNING: { label: "Avertissement", icon: TriangleAlert, color: "text-warn-500" },
  DEPARTURE: { label: "Départ du service", icon: LogOut, color: "text-mist-400" },
  DEATH: { label: "Décès", icon: Skull, color: "text-alert-500" },
};

export function MeetingRecap({
  meeting,
  action,
  variant = "default",
  compact = false,
}: {
  meeting: MeetingCardData;
  action?: ReactNode;
  variant?: "default" | "blue";
  compact?: boolean;
}) {
  return (
    <Panel
      className={
        variant === "blue" ? "border-badge-500/40 bg-badge-600/[0.05]" : undefined
      }
    >
      <PanelHeader
        title="Récapitulatif de réunion"
        subtitle={
          meeting.meetingDate
            ? `Réunion du ${formatDate(meeting.meetingDate)} · publié par ${meeting.createdByName}`
            : `Publié par ${meeting.createdByName} · ${formatDateTime(meeting.createdAt)}`
        }
        action={action}
      />
      <div
        className={`grid gap-px bg-ink-700 ${compact ? "" : "md:grid-cols-2"}`}
      >
        <div className="bg-ink-900 px-5 py-4">
          <p className="label-tag mb-2">Compte rendu</p>
          <p className="text-sm leading-relaxed whitespace-pre-line text-mist-200">
            {meeting.summary}
          </p>
        </div>
        <div className="space-y-4 bg-ink-900 px-5 py-4">
          <div>
            <p className="label-tag mb-2">Montées / descentes de grade</p>
            {meeting.gradeChanges.length === 0 ? (
              <p className="text-xs text-mist-500">
                Aucun changement de grade cette semaine.
              </p>
            ) : (
              <ul className="space-y-2">
                {meeting.gradeChanges.map((g) => (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                  >
                    {g.direction === "PROMOTION" ? (
                      <ArrowUp className="h-4 w-4 shrink-0 text-ok-500" />
                    ) : (
                      <ArrowDown className="h-4 w-4 shrink-0 text-alert-500" />
                    )}
                    <span className="text-sm font-medium text-mist-100">
                      {g.agentName}
                    </span>
                    <span className="text-xs text-mist-500">
                      {g.fromRankName} →{" "}
                      <span className="text-mist-200">{g.toRankName}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {meeting.events.length > 0 ? (
            <div className="border-t border-ink-700 pt-3">
              <p className="label-tag mb-2">Avertissements, départs & décès</p>
              <ul className="space-y-2">
                {meeting.events.map((ev) => {
                  const meta = EVENT_META[ev.type] ?? EVENT_META.WARNING;
                  const Icon = meta.icon;
                  return (
                    <li
                      key={ev.id}
                      className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
                      <span className="text-sm font-medium text-mist-100">
                        {ev.agentName}
                      </span>
                      <span className="text-xs text-mist-500">{meta.label}</span>
                      {ev.reason ? (
                        <span className="text-xs text-mist-400">
                          — {ev.reason}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      {meeting.signature ? (
        <div className="border-t border-ink-700 px-5 py-3">
          <p className="font-serif text-sm italic text-mist-300">
            {meeting.signature}
          </p>
        </div>
      ) : null}
    </Panel>
  );
}
