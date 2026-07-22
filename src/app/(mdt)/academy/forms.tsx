"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import { createScheduleSlot, type ScheduleState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

const DAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

export function AddSlotForm() {
  const [state, action, pending] = useActionState<ScheduleState, FormData>(
    createScheduleSlot,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Jour">
          <select name="dayOfWeek" defaultValue="0" className={inputClass}>
            {DAYS.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Intitulé">
          <Input name="title" required placeholder="Cours de conduite" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Début" hint="Entre 15h00 et 00h00.">
          <Input name="start" type="time" required defaultValue="15:00" />
        </Field>
        <Field label="Fin">
          <Input name="end" type="time" required defaultValue="17:00" />
        </Field>
        <Field label="Lieu (optionnel)">
          <Input name="location" placeholder="Salle de briefing" />
        </Field>
      </div>

      <Field
        label="Détails (optionnel)"
      >
        <textarea name="details" rows={3} className={inputClass} />
      </Field>

      <ActionFeedback error={state?.error} success={state?.success} />

      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "Ajout…" : "Ajouter au planning"}
      </Button>
    </form>
  );
}
