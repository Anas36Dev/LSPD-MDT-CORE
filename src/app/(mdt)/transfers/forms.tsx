"use client";

import { useActionState, useState } from "react";

import { X } from "lucide-react";

import { Button, Field } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { ActionFeedback } from "@/components/action-feedback";
import {
  applyForTransfer,
  decideTransfer,
  deleteTransfer,
  type TransferState,
} from "./actions";

export function DeleteTransferButton({ requestId }: { requestId: number }) {
  return (
    <ConfirmButton
      action={deleteTransfer}
      fields={{ id: requestId }}
      title="Supprimer la demande"
      message="Supprimer définitivement cette demande de mutation ? Cette action est irréversible."
      confirmLabel="Supprimer définitivement"
      triggerTitle="Supprimer définitivement"
      triggerClassName="rounded-md p-1 text-mist-500 transition-colors hover:text-alert-500"
      trigger={<X className="h-4 w-4" />}
    />
  );
}

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

function Feedback({ state }: { state: TransferState }) {
  return (
    <ActionFeedback error={state?.error} success={state?.success} />
  );
}

export type DivisionOption = {
  id: number;
  name: string;
  subDivisions: { id: number; name: string }[];
};

export function ApplyForm({
  divisions,
  eligible,
  rankName,
}: {
  divisions: DivisionOption[];
  eligible: boolean;
  rankName: string;
}) {
  const [state, action, pending] = useActionState<TransferState, FormData>(
    applyForTransfer,
    undefined,
  );
  const [divisionId, setDivisionId] = useState("");

  const selected = divisions.find((d) => String(d.id) === divisionId);

  if (!eligible) {
    return (
      <p className="px-5 py-4 text-sm leading-relaxed text-warn-500">
        Les divisions sont accessibles à partir du grade de Police Officer II.
        Votre grade actuel ({rankName}) ne permet pas encore de candidater.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Division visée">
          <select
            name="divisionId"
            value={divisionId}
            onChange={(e) => setDivisionId(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">— Choisir —</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>

        {selected && selected.subDivisions.length > 0 ? (
          <Field label="Unité souhaitée" hint="Facultatif.">
            <select name="subDivisionId" className={inputClass}>
              <option value="">— Indifférent —</option>
              {selected.subDivisions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      <Field
        label="Motivation"
        hint="Expliquez votre démarche : expérience, compétences, disponibilité."
      >
        <textarea name="motivation" rows={4} className={inputClass} required />
      </Field>

      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Dépôt…" : "Déposer ma candidature"}
      </Button>
    </form>
  );
}

export function DecisionForm({ requestId }: { requestId: number }) {
  const [state, action, pending] = useActionState<TransferState, FormData>(
    decideTransfer,
    undefined,
  );

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="id" value={requestId} />

      <textarea
        name="decisionNote"
        rows={2}
        placeholder="Motif de la décision (obligatoire en cas de refus)"
        className={inputClass}
      />

      <Feedback state={state} />

      <div className="flex gap-2.5">
        <Button
          type="submit"
          name="decision"
          value="ACCEPTED"
          disabled={pending}
        >
          Accepter
        </Button>
        <Button
          type="submit"
          name="decision"
          value="REJECTED"
          variant="danger"
          disabled={pending}
        >
          Refuser
        </Button>
      </div>
    </form>
  );
}
