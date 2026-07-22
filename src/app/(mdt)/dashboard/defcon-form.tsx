"use client";

import { useActionState, useState } from "react";

import { Button, Field } from "@/components/ui";
import { DEFCON_LEVELS } from "@/components/defcon";
import { ActionFeedback } from "@/components/action-feedback";
import { setDefcon, type DispatchState } from "../dispatch/actions";

export function DefconForm({ current }: { current: number }) {
  const [state, action, pending] = useActionState<DispatchState, FormData>(
    setDefcon,
    undefined,
  );
  const [level, setLevel] = useState(current);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-lg border border-ink-600 px-3 py-2 text-xs text-mist-300 transition-colors hover:border-gold-500/50 hover:text-gold-400"
      >
        Modifier le niveau
      </button>
    );
  }

  return (
    <form action={action} className="w-full space-y-4 border-t border-ink-700 pt-4">
      <div>
        <p className="label-tag mb-2">Niveau DEFCON</p>
        <div className="flex flex-wrap gap-2">
          {[5, 4, 3, 2, 1].map((l) => {
            const d = DEFCON_LEVELS[l];
            const active = level === l;
            return (
              <label
                key={l}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                  active
                    ? `${d.border} ${d.bg}`
                    : "border-ink-700 hover:border-ink-600"
                }`}
              >
                <input
                  type="radio"
                  name="level"
                  value={l}
                  checked={active}
                  onChange={() => setLevel(l)}
                  className="sr-only"
                />
                <span
                  className="h-3 w-3 rounded-full border border-white/20"
                  style={{ backgroundColor: d.color }}
                />
                <span
                  className={`text-sm font-semibold ${active ? d.text : "text-mist-300"}`}
                >
                  {l}
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-mist-500">
          {DEFCON_LEVELS[level]?.label}
        </p>
      </div>

      <Field
        label="Motif"
        hint={
          level <= 3
            ? "Obligatoire à partir du niveau 3 : il change les règles de port d'arme sur le terrain."
            : "Facultatif."
        }
      >
        <textarea
          name="reason"
          rows={2}
          className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none"
          required={level <= 3}
        />
      </Field>

      <ActionFeedback error={state?.error} success={state?.success} />
      <ActionFeedback success={state?.success} />

      <div className="flex gap-2.5">
        <Button type="submit" disabled={pending}>
          {pending ? "Application…" : "Appliquer"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
