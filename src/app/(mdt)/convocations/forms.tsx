"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import { createConvocation, type ConvocationState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

export type AgentOption = { id: number; label: string };

export function ConvocationForm({ agents }: { agents: AgentOption[] }) {
  const [state, action, pending] = useActionState<ConvocationState, FormData>(
    createConvocation,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <Field label="Agent à convoquer">
        <select name="agentId" defaultValue="" required className={inputClass}>
          <option value="">— Choisir un agent —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lieu">
          <Input
            name="location"
            required
            placeholder="Bureau du Command Staff, Mission Row…"
          />
        </Field>
        <Field label="Date et heure (facultatif)">
          <Input name="scheduledAt" type="datetime-local" />
        </Field>
      </div>

      <Field label="Motif">
        <textarea
          name="reason"
          rows={3}
          required
          placeholder="Objet de la convocation…"
          className={inputClass}
        />
      </Field>

      <ActionFeedback error={state?.error} success={state?.success} />

      <Button type="submit" disabled={pending || agents.length === 0}>
        <Send className="h-4 w-4" />
        {pending ? "Envoi…" : "Envoyer la convocation"}
      </Button>
    </form>
  );
}
