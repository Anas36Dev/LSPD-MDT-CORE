"use client";

import { useActionState, useEffect, useState } from "react";
import { KeyRound, Lock, Plus, Send, X } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import {
  createLocker,
  depositItem,
  unlockLocker,
  type LockerState,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

export function DepositForm({ lockerId }: { lockerId: number }) {
  const [state, action, pending] = useActionState<LockerState, FormData>(
    depositItem,
    undefined,
  );

  return (
    <form
      action={action}
      className="space-y-2 border-t border-ink-700 px-4 py-3"
    >
      <input type="hidden" name="lockerId" value={lockerId} />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <input
            name="label"
            required
            placeholder="Objet déposé…"
            className={inputClass}
          />
        </div>
        <div className="w-16 shrink-0">
          <input
            name="quantity"
            type="number"
            min={1}
            placeholder="Qté"
            className={inputClass}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          className="shrink-0 px-3 py-2"
          title="Annoncer le dépôt"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <ActionFeedback error={state?.error} success={state?.success} />
    </form>
  );
}

export function UnlockForm({ lockerId }: { lockerId: number }) {
  const [state, action, pending] = useActionState<LockerState, FormData>(
    unlockLocker,
    undefined,
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-600 bg-ink-850 text-mist-400">
        <Lock className="h-5 w-5" />
      </span>
      <p className="text-center text-xs text-mist-500">
        Casier verrouillé. Saisissez le code d&apos;accès pour voir son contenu.
      </p>
      <form action={action} className="w-full max-w-56 space-y-2">
        <input type="hidden" name="lockerId" value={lockerId} />
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input name="code" required placeholder="Code d'accès" autoComplete="off" />
          </div>
          <Button
            type="submit"
            disabled={pending}
            className="shrink-0 px-3 py-2"
            title="Déverrouiller"
          >
            <KeyRound className="h-4 w-4" />
          </Button>
        </div>
        <ActionFeedback error={state?.error} success={state?.success} />
      </form>
    </div>
  );
}

export function CreateLockerButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<LockerState, FormData>(
    createLocker,
    undefined,
  );

  // Ferme la fenêtre une fois le casier créé.
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
        Créer un casier
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
              <h2 className="text-sm font-semibold text-mist-100">
                Nouveau casier
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-mist-500 transition-colors hover:text-mist-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form action={action} className="space-y-4 px-5 py-4">
              <Field label="Nom du casier">
                <Input name="name" required placeholder="Casier armurerie…" />
              </Field>
              <Field label="Code d'accès (facultatif)">
                <Input name="accessCode" placeholder="Ex : 1234" />
              </Field>
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
                  {pending ? "Création…" : "Créer le casier"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
