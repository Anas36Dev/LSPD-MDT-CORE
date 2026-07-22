"use client";

import { useActionState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { ActionFeedback } from "@/components/action-feedback";
import {
  addInvestigationInfo,
  addInvestigationNote,
  createInvestigation,
  deleteInvestigation,
  linkReport,
  type InvState,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

function Feedback({ state }: { state: InvState }) {
  return (
    <ActionFeedback error={state?.error} success={state?.success} />
  );
}

export function CreateInvestigationForm() {
  const [state, action, pending] = useActionState<InvState, FormData>(
    createInvestigation,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <Field label="Titre de l'enquête">
        <Input name="title" required placeholder="Réseau de trafic — secteur Vespucci" />
      </Field>
      <Field label="Résumé / objet">
        <textarea name="summary" rows={3} required className={inputClass} />
      </Field>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "Ouverture…" : "Ouvrir l'enquête"}
      </Button>
    </form>
  );
}

export function InvestigationNoteForm({ investigationId }: { investigationId: number }) {
  const [state, action, pending] = useActionState<InvState, FormData>(
    addInvestigationNote,
    undefined,
  );

  return (
    <form action={action} className="space-y-2 border-t border-ink-700 px-5 py-4">
      <input type="hidden" name="investigationId" value={investigationId} />
      <textarea
        name="body"
        rows={2}
        placeholder="Consigner un élément d'enquête…"
        className={inputClass}
      />
      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter au journal"}
      </Button>
    </form>
  );
}

export function DeleteInvestigationButton({
  investigationId,
}: {
  investigationId: number;
}) {
  return (
    <ConfirmButton
      action={deleteInvestigation}
      fields={{ investigationId }}
      title="Supprimer l'enquête"
      message="Supprimer définitivement cette enquête archivée ? Cette action est irréversible."
      confirmLabel="Supprimer définitivement"
      triggerClassName="inline-flex items-center gap-1.5 rounded-md border border-alert-500/50 px-2.5 py-1 text-xs text-alert-500 transition-colors hover:bg-alert-600/15"
      trigger={
        <>
          <Trash2 className="h-3.5 w-3.5" />
          Supprimer définitivement
        </>
      }
    />
  );
}

export function InvestigationInfoForm({ investigationId }: { investigationId: number }) {
  const [state, action, pending] = useActionState<InvState, FormData>(
    addInvestigationInfo,
    undefined,
  );

  return (
    <form action={action} className="space-y-3 border-t border-ink-700 px-5 py-4">
      <input type="hidden" name="investigationId" value={investigationId} />
      <Field label="Intitulé">
        <Input name="label" required placeholder="Suspect principal, véhicule, lieu…" />
      </Field>
      <Field label="Détail">
        <textarea name="content" rows={3} required className={inputClass} />
      </Field>
      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "Ajout…" : "Ajouter l'information"}
      </Button>
    </form>
  );
}

export function LinkReportForm({
  investigationId,
  reports,
}: {
  investigationId: number;
  reports: { id: number; label: string }[];
}) {
  const [state, action, pending] = useActionState<InvState, FormData>(
    linkReport,
    undefined,
  );

  return (
    <form action={action} className="space-y-3 border-t border-ink-700 px-5 py-4">
      <input type="hidden" name="investigationId" value={investigationId} />
      <div className="flex gap-2">
        <select name="reportId" defaultValue="" className={inputClass}>
          <option value="">Rattacher un rapport existant…</option>
          {reports.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          className="shrink-0"
        >
          {pending ? "…" : "Rattacher"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
