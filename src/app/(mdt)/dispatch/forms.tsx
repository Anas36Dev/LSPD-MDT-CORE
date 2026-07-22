"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import { createPatrol, type DispatchState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

type CallSign = { code: string; label: string };

/**
 * Bouton « Créer une patrouille » en tête de page : ouvre une fenêtre modale
 * contenant le formulaire (même patron que les autres onglets « Créer… »).
 */
export function PatrolButton({
  callSigns,
  label,
  hint,
}: {
  callSigns: CallSign[];
  label: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DispatchState, FormData>(
    createPatrol,
    undefined,
  );

  // Ferme la fenêtre une fois la patrouille créée.
  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state?.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-badge-500/60 bg-badge-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-badge-500"
      >
        <Plus className="h-4 w-4" />
        {label}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 py-16"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 text-left shadow-2xl shadow-black/50"
          >
            <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
              <h2 className="text-sm font-semibold text-mist-100">{label}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer text-mist-500 transition-colors hover:text-mist-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form action={action} className="space-y-4 px-5 py-4">
              {hint ? <p className="text-xs text-mist-500">{hint}</p> : null}
              <Field label="Call sign">
                <select name="callSign" className={inputClass} required>
                  {callSigns.map((c) => (
                    <option key={c.code} value={c.code} title={c.label}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex gap-3">
                <div className="w-24">
                  <Field label="Numéro">
                    <Input name="number" placeholder="12" required />
                  </Field>
                </div>
                <div className="min-w-0 flex-1">
                  <Field label="Secteur">
                    <Input name="sector" placeholder="Vespucci" />
                  </Field>
                </div>
              </div>
              <ActionFeedback error={state?.error} success={state?.success} />
              <div className="flex justify-end gap-2 border-t border-ink-700 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={pending}>
                  <Plus className="h-4 w-4" />
                  {pending ? "Création…" : label}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
