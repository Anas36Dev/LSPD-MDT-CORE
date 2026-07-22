"use client";

import { useActionState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import {
  addNote,
  closeCase,
  issueSanction,
  openCase,
  type IaState,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

export type AgentOption = { id: number; label: string };

function Feedback({ state }: { state: IaState }) {
  return (
    <ActionFeedback error={state?.error} success={state?.success} />
  );
}

// ---------------------------------------------------------------------------
// Ouverture d'un dossier
// ---------------------------------------------------------------------------

export function OpenCaseForm({ agents }: { agents: AgentOption[] }) {
  const [state, action, pending] = useActionState<IaState, FormData>(
    openCase,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Agent mis en cause">
          <select name="subjectId" className={inputClass} required>
            <option value="">— Choisir —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Gravité">
          <select name="severity" defaultValue="MEDIUM" className={inputClass}>
            <option value="LOW">Faible</option>
            <option value="MEDIUM">Moyenne</option>
            <option value="HIGH">Élevée</option>
            <option value="CRITICAL">Critique</option>
          </select>
        </Field>
      </div>

      <Field label="Objet du dossier">
        <Input name="title" required placeholder="Usage disproportionné de la force" />
      </Field>

      <Field label="Résumé des faits">
        <textarea name="summary" rows={4} className={inputClass} required />
      </Field>

      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Ouverture…" : "Ouvrir le dossier"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Note d'enquête
// ---------------------------------------------------------------------------

export function NoteForm({ caseId }: { caseId: number }) {
  const [state, action, pending] = useActionState<IaState, FormData>(
    addNote,
    undefined,
  );

  return (
    <form action={action} className="space-y-3 border-t border-ink-700 px-5 py-4">
      <input type="hidden" name="caseId" value={caseId} />
      <Field
        label="Nouvelle note d'enquête"
        hint="Horodatée et attribuée à son auteur. Elle ne pourra plus être retirée."
      >
        <textarea name="body" rows={3} className={inputClass} required />
      </Field>
      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter la note"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Clôture
// ---------------------------------------------------------------------------

export function CloseCaseForm({ caseId }: { caseId: number }) {
  const [state, action, pending] = useActionState<IaState, FormData>(
    closeCase,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <input type="hidden" name="caseId" value={caseId} />

      <Field label="Conclusions de l'enquête">
        <textarea name="outcome" rows={3} className={inputClass} required />
      </Field>

      <Feedback state={state} />

      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" name="status" value="CLOSED" disabled={pending}>
          Clore avec suite
        </Button>
        <Button
          type="submit"
          name="status"
          value="DISMISSED"
          variant="secondary"
          disabled={pending}
        >
          Classer sans suite
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sanction
// ---------------------------------------------------------------------------

export function SanctionForm({
  caseId,
  subjectId,
  subjectName,
}: {
  caseId?: number;
  subjectId: number;
  subjectName: string;
}) {
  const [state, action, pending] = useActionState<IaState, FormData>(
    issueSanction,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 border-t border-ink-700 px-5 py-4">
      {caseId ? <input type="hidden" name="caseId" value={caseId} /> : null}
      <input type="hidden" name="subjectId" value={subjectId} />

      <p className="text-sm text-mist-300">
        Sanction à l&apos;encontre de{" "}
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

      <Feedback state={state} />
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Enregistrement…" : "Prononcer la sanction"}
      </Button>
    </form>
  );
}
