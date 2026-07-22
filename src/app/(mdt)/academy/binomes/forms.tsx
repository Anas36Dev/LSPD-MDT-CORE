"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";

import { Button, Field } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import {
  addPartnershipNote,
  createPartnership,
  type BinomeState,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

type Person = { id: number; label: string };

function Feedback({ state }: { state: BinomeState }) {
  return (
    <ActionFeedback error={state?.error} success={state?.success} />
  );
}

export function CreatePartnershipForm({
  rookies,
  instructors,
}: {
  rookies: Person[];
  instructors: Person[];
}) {
  const [state, action, pending] = useActionState<BinomeState, FormData>(
    createPartnership,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Recrue">
          <select name="rookieId" defaultValue="" className={inputClass}>
            <option value="">— Choisir une recrue —</option>
            {rookies.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Instructeur">
          <select name="instructorId" defaultValue="" className={inputClass}>
            <option value="">— Choisir un instructeur —</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "Création…" : "Créer le binôme"}
      </Button>
    </form>
  );
}

export function PartnershipNoteForm({
  partnershipId,
}: {
  partnershipId: number;
}) {
  const [state, action, pending] = useActionState<BinomeState, FormData>(
    addPartnershipNote,
    undefined,
  );

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="partnershipId" value={partnershipId} />
      <textarea
        name="body"
        rows={2}
        placeholder="Note sur le binôme…"
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="visibility"
          defaultValue="BOTH"
          className="rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-1.5 text-xs text-mist-100 focus:border-badge-500 focus:outline-none"
        >
          <option value="BOTH">Visible : les 2 membres</option>
          <option value="ROOKIE">Visible : la recrue seule</option>
          <option value="INSTRUCTOR">Visible : l&apos;instructeur seul</option>
          <option value="PUBLIC">Visible : tout le monde</option>
        </select>
        <Button type="submit" variant="secondary" disabled={pending} className="text-xs">
          {pending ? "Ajout…" : "Ajouter la note"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
