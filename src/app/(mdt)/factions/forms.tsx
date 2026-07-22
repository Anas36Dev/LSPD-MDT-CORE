"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import {
  addFactionNote,
  createFaction,
  linkCivilian,
  linkInvestigation,
  linkReport,
  type FactionState,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

type Opt = { id: number; label: string };

function Feedback({ state }: { state: FactionState }) {
  return (
    <ActionFeedback error={state?.error} success={state?.success} />
  );
}

export function CreateFactionForm() {
  const [state, action, pending] = useActionState<FactionState, FormData>(
    createFaction,
    undefined,
  );
  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <Field label="Nom du groupuscule">
        <Input name="name" required placeholder="Les Vagos, Ballas…" />
      </Field>
      <Field label="Description / revendications">
        <textarea name="description" rows={3} required className={inputClass} />
      </Field>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "Création…" : "Créer le groupuscule"}
      </Button>
    </form>
  );
}

export function FactionNoteForm({ factionId }: { factionId: number }) {
  const [state, action, pending] = useActionState<FactionState, FormData>(
    addFactionNote,
    undefined,
  );
  return (
    <form action={action} className="space-y-2 border-t border-ink-700 px-5 py-4">
      <input type="hidden" name="factionId" value={factionId} />
      <textarea
        name="body"
        rows={2}
        placeholder="Consigner un élément sur le groupe…"
        className={inputClass}
      />
      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter au journal"}
      </Button>
    </form>
  );
}

function LinkSelect({
  action,
  factionId,
  name,
  options,
  placeholder,
}: {
  action: (state: FactionState, fd: FormData) => Promise<FactionState>;
  factionId: number;
  name: string;
  options: Opt[];
  placeholder: string;
}) {
  const [state, formAction, pending] = useActionState<FactionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="space-y-2 border-t border-ink-700 px-5 py-4">
      <input type="hidden" name="factionId" value={factionId} />
      <div className="flex gap-2">
        <select name={name} defaultValue="" className={inputClass}>
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {name === "civilianId" ? (
          <Input name="role" placeholder="Rôle (optionnel)" className="max-w-40" />
        ) : null}
        <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
          {pending ? "…" : "Rattacher"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function LinkReportForm(props: { factionId: number; options: Opt[] }) {
  return (
    <LinkSelect
      action={linkReport}
      factionId={props.factionId}
      name="reportId"
      options={props.options}
      placeholder="Rattacher un rapport…"
    />
  );
}

export function LinkInvestigationForm(props: { factionId: number; options: Opt[] }) {
  return (
    <LinkSelect
      action={linkInvestigation}
      factionId={props.factionId}
      name="investigationId"
      options={props.options}
      placeholder="Rattacher une enquête…"
    />
  );
}

export function LinkCivilianForm(props: { factionId: number; options: Opt[] }) {
  return (
    <LinkSelect
      action={linkCivilian}
      factionId={props.factionId}
      name="civilianId"
      options={props.options}
      placeholder="Rattacher un civil recensé…"
    />
  );
}
