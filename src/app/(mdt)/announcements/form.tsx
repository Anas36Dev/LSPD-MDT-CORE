"use client";

import { useActionState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import { createAnnouncement, type AnnouncementState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

export function AnnouncementForm({
  divisions,
}: {
  divisions: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState<AnnouncementState, FormData>(
    createAnnouncement,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <Field label="Titre">
        <Input name="title" required />
      </Field>

      <Field label="Message">
        <textarea name="body" rows={4} className={inputClass} required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priorité">
          <select name="priority" defaultValue="NORMAL" className={inputClass}>
            <option value="NORMAL">Normale</option>
            <option value="IMPORTANT">Importante</option>
            <option value="URGENT">Urgente</option>
          </select>
        </Field>

        <Field
          label="Destinataires"
          hint="Une annonce ciblée n'est visible que par la division concernée."
        >
          <select name="divisionId" className={inputClass}>
            <option value="">Tout le département</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            name="isPinned"
            className="h-4 w-4 accent-[var(--color-badge-500)]"
          />
          <span className="text-sm text-mist-300">Épingler en haut</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            name="visibleToAcademy"
            className="h-4 w-4 accent-[var(--color-gold-500)]"
          />
          <span className="text-sm text-mist-300">
            Visible par les Rookies de l&apos;académie
          </span>
        </label>
      </div>

      <ActionFeedback error={state?.error} success={state?.success} />
      <ActionFeedback success={state?.success} />

      <Button type="submit" disabled={pending}>
        {pending ? "Publication…" : "Publier l'annonce"}
      </Button>
    </form>
  );
}
