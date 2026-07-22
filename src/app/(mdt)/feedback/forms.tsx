"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";

import { Button, Field } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import { submitFeedback, type FeedbackState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

export function FeedbackForm() {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(
    submitFeedback,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <Field label="Type de retour">
        <select name="type" defaultValue="SUGGESTION" className={inputClass}>
          <option value="SUGGESTION">Suggestion d&apos;amélioration</option>
          <option value="BUG">Bug / problème rencontré</option>
          <option value="OTHER">Autre</option>
        </select>
      </Field>
      <Field label="Votre message">
        <textarea
          name="message"
          rows={5}
          required
          placeholder="Décrivez votre suggestion ou le problème rencontré…"
          className={inputClass}
        />
      </Field>

      <ActionFeedback error={state?.error} success={state?.success} />

      <Button type="submit" disabled={pending}>
        <Send className="h-4 w-4" />
        {pending ? "Envoi…" : "Envoyer le retour"}
      </Button>
    </form>
  );
}
