"use client";

import { useActionState, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Badge, Button, Panel } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import { addAgentNote, type NoteState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

function AgentNoteForm({ code, subjectId }: { code: string; subjectId: number }) {
  const [state, action, pending] = useActionState<NoteState, FormData>(
    addAgentNote,
    undefined,
  );

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <textarea
        name="body"
        rows={2}
        placeholder="Ajouter une note privée sur cet agent…"
        className={inputClass}
      />
      <ActionFeedback error={state?.error} success={state?.success} />
      <Button type="submit" variant="secondary" disabled={pending} className="text-xs">
        {pending ? "Enregistrement…" : "Ajouter la note"}
      </Button>
    </form>
  );
}

export type SupervisedAgent = {
  id: number;
  name: string;
  rank: string;
  badge: string;
  reportCount: number;
  investigationCount: number;
  notes: { id: number; body: string; author: string; date: string }[];
};

export function AgentSupervisionCard({
  code,
  agent,
  showInvestigations,
}: {
  code: string;
  agent: SupervisedAgent;
  showInvestigations: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Panel>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-ink-800/40"
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-mist-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-mist-100">{agent.name}</p>
          <p className="text-xs text-mist-500">{agent.rank}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Badge tone="blue">{agent.reportCount} rapport(s)</Badge>
          {showInvestigations ? (
            <Badge tone="amber">{agent.investigationCount} enquête(s)</Badge>
          ) : null}
          {agent.notes.length > 0 ? (
            <Badge tone="gold">{agent.notes.length} note(s)</Badge>
          ) : null}
          <Badge tone="neutral">#{agent.badge}</Badge>
        </div>
      </button>

      {open ? (
        <div className="border-t border-ink-700 px-5 py-4">
          {agent.notes.length === 0 ? (
            <p className="text-xs text-mist-500">Aucune note pour cet agent.</p>
          ) : (
            <ul className="space-y-2.5">
              {agent.notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border border-ink-700 bg-ink-850/60 px-3.5 py-2.5"
                >
                  <p className="text-sm whitespace-pre-line text-mist-100">
                    {n.body}
                  </p>
                  <p className="mt-1 text-xs text-mist-500">
                    {n.author} · {n.date}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <AgentNoteForm code={code} subjectId={agent.id} />
        </div>
      ) : null}
    </Panel>
  );
}
