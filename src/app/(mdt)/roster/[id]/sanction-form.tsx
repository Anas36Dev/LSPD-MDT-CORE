"use client";

import { useActionState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import { issueDirectSanction, type SanctionState } from "../actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

export function DirectSanctionForm({
  subjectId,
  subjectName,
}: {
  subjectId: number;
  subjectName: string;
}) {
  const [state, action, pending] = useActionState<SanctionState, FormData>(
    issueDirectSanction,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 border-t border-ink-700 px-5 py-4">
      <input type="hidden" name="subjectId" value={subjectId} />

      <p className="text-sm text-mist-300">
        Sanction directe à l&apos;encontre de{" "}
        <span className="font-medium text-mist-100">{subjectName}</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type de sanction">
          <select name="type" className={inputClass} required>
            <option value="">— Choisir —</option>
            <option value="WARNING">Avertissement</option>
            <option value="REPRIMAND">Blâme</option>
            <option value="SUSPENSION">Suspension</option>
            <option value="DEMOTION">Rétrogradation</option>
            <option value="TERMINATION">Révocation</option>
          </select>
        </Field>
        <Field label="Fin de la sanction" hint="Laisser vide si indéterminée.">
          <Input name="endsAt" type="date" />
        </Field>
      </div>

      <Field label="Motif">
        <textarea name="reason" rows={2} className={inputClass} required />
      </Field>

      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          name="isPublic"
          className="h-4 w-4 accent-[var(--color-alert-500)]"
        />
        <span className="text-sm text-mist-300">
          Sanction publique — visible sur le dossier consultable par tous
        </span>
      </label>

      <p className="rounded-lg border border-warn-500/30 bg-warn-500/5 px-3.5 py-2.5 text-xs leading-relaxed text-warn-500">
        Une suspension ou une révocation ferme immédiatement l&apos;accès au
        terminal et déconnecte l&apos;agent.
      </p>

      <ActionFeedback error={state?.error} success={state?.success} />

      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Enregistrement…" : "Prononcer la sanction"}
      </Button>
    </form>
  );
}
