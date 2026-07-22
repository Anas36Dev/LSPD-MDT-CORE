"use client";

import { useActionState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import { sendMessage, type MessageState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

export function MessageForm({
  agents,
  defaultRecipientId,
}: {
  agents: { id: number; label: string }[];
  defaultRecipientId?: number;
}) {
  const [state, action, pending] = useActionState<MessageState, FormData>(
    sendMessage,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Destinataire">
          <select
            name="recipientId"
            defaultValue={defaultRecipientId ?? ""}
            className={inputClass}
            required
          >
            <option value="">— Choisir —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Objet">
          <Input name="subject" required />
        </Field>
      </div>

      <Field label="Message">
        <textarea name="body" rows={4} className={inputClass} required />
      </Field>

      <ActionFeedback error={state?.error} success={state?.success} />
      <ActionFeedback success={state?.success} />

      <Button type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer"}
      </Button>
    </form>
  );
}
