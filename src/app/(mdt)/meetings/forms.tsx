"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus, Send, X } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { SignatureField } from "@/components/signature-field";
import { ActionFeedback } from "@/components/action-feedback";
import { createMeeting, updateMeeting, type MeetingState } from "./actions";

export type AgentOption = { id: number; label: string };
export type RankOption = { code: string; name: string };

export type MeetingInitial = {
  id: number;
  summary: string;
  meetingDate: string; // yyyy-mm-dd ou ""
  gradeRows: { userId: number; rankCode: string }[];
  eventRows: { userId: number; type: string; reason: string }[];
};

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

const EVENT_LABELS: { value: string; label: string }[] = [
  { value: "WARNING", label: "Avertissement" },
  { value: "DEPARTURE", label: "Départ du service" },
  { value: "DEATH", label: "Décès" },
];

type GradeRow = { key: number; userId: string; rankCode: string };
type EventRow = { key: number; userId: string; type: string; reason: string };

export function MeetingForm({
  agents,
  ranks,
  signature,
  mode = "create",
  initial,
}: {
  agents: AgentOption[];
  ranks: RankOption[];
  signature: string;
  mode?: "create" | "edit";
  initial?: MeetingInitial;
}) {
  const isEdit = mode === "edit";
  const [state, action, pending] = useActionState<MeetingState, FormData>(
    isEdit ? updateMeeting : createMeeting,
    undefined,
  );

  let seed = 0;
  const [gradeRows, setGradeRows] = useState<GradeRow[]>(
    (initial?.gradeRows ?? []).map((r) => ({
      key: seed++,
      userId: String(r.userId),
      rankCode: r.rankCode,
    })),
  );
  const [eventRows, setEventRows] = useState<EventRow[]>(
    (initial?.eventRows ?? []).map((r) => ({
      key: seed++,
      userId: String(r.userId),
      type: r.type,
      reason: r.reason,
    })),
  );
  const [counter, setCounter] = useState(seed);
  const nextKey = () => {
    const k = counter;
    setCounter((c) => c + 1);
    return k;
  };

  const addGrade = () =>
    setGradeRows((r) => [...r, { key: nextKey(), userId: "", rankCode: "" }]);
  const addEvent = () =>
    setEventRows((r) => [
      ...r,
      { key: nextKey(), userId: "", type: "WARNING", reason: "" },
    ]);

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      {isEdit && initial ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      <Field label="Date de la réunion">
        <Input
          name="meetingDate"
          type="date"
          defaultValue={initial?.meetingDate}
          className="sm:max-w-xs"
        />
      </Field>

      <Field label="Récapitulatif de la réunion">
        <textarea
          name="summary"
          rows={6}
          required
          defaultValue={initial?.summary}
          placeholder="Points abordés, décisions, annonces…"
          className={inputClass}
        />
      </Field>

      {/* --- Montées / descentes de grade -------------------------------- */}
      <div>
        <div className="flex items-center justify-between">
          <span className="label-tag">Montées / descentes de grade</span>
          <button
            type="button"
            onClick={addGrade}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-300 transition-colors hover:border-badge-500/50 hover:text-badge-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </div>
        {gradeRows.length === 0 ? (
          <p className="mt-1.5 text-xs text-mist-500">
            Aucun changement de grade.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {gradeRows.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <select
                  name="gradeUserId"
                  value={row.userId}
                  onChange={(e) =>
                    setGradeRows((rows) =>
                      rows.map((r) =>
                        r.key === row.key ? { ...r, userId: e.target.value } : r,
                      ),
                    )
                  }
                  className={inputClass}
                >
                  <option value="">— Agent —</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <select
                  name="gradeRankCode"
                  value={row.rankCode}
                  onChange={(e) =>
                    setGradeRows((rows) =>
                      rows.map((r) =>
                        r.key === row.key ? { ...r, rankCode: e.target.value } : r,
                      ),
                    )
                  }
                  className={inputClass}
                >
                  <option value="">— Nouveau grade —</option>
                  {ranks.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setGradeRows((rows) => rows.filter((r) => r.key !== row.key))
                  }
                  title="Retirer"
                  className="shrink-0 rounded-md p-1.5 text-mist-500 transition-colors hover:text-alert-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Avertissements / départs / décès ---------------------------- */}
      <div>
        <div className="flex items-center justify-between">
          <span className="label-tag">Avertissements, départs & décès</span>
          <button
            type="button"
            onClick={addEvent}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-300 transition-colors hover:border-badge-500/50 hover:text-badge-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </div>
        {eventRows.length === 0 ? (
          <p className="mt-1.5 text-xs text-mist-500">Aucun événement.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {eventRows.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <select
                    name="eventUserId"
                    value={row.userId}
                    onChange={(e) =>
                      setEventRows((rows) =>
                        rows.map((r) =>
                          r.key === row.key ? { ...r, userId: e.target.value } : r,
                        ),
                      )
                    }
                    className={inputClass}
                  >
                    <option value="">— Agent —</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-44 shrink-0">
                  <select
                    name="eventType"
                    value={row.type}
                    onChange={(e) =>
                      setEventRows((rows) =>
                        rows.map((r) =>
                          r.key === row.key ? { ...r, type: e.target.value } : r,
                        ),
                      )
                    }
                    className={inputClass}
                  >
                    {EVENT_LABELS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    name="eventReason"
                    value={row.reason}
                    onChange={(e) =>
                      setEventRows((rows) =>
                        rows.map((r) =>
                          r.key === row.key ? { ...r, reason: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder={
                      row.type === "WARNING"
                        ? "Motif (facultatif)"
                        : "Note (facultatif)"
                    }
                    className={inputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEventRows((rows) => rows.filter((r) => r.key !== row.key))
                  }
                  title="Retirer"
                  className="shrink-0 rounded-md p-1.5 text-mist-500 transition-colors hover:text-alert-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <SignatureField
        signature={signature}
        label="Signature du rédacteur"
        hint="Obligatoire pour publier le récapitulatif."
      />

      <ActionFeedback error={state?.error} success={state?.success} />

      <Button type="submit" disabled={pending}>
        {isEdit ? <Pencil className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        {pending
          ? "Enregistrement…"
          : isEdit
            ? "Enregistrer les modifications"
            : "Publier le récapitulatif"}
      </Button>
    </form>
  );
}
