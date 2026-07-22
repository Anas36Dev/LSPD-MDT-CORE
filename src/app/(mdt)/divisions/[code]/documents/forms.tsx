"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";

import { Button, Field, Input, Panel, PanelHeader } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import {
  createDivisionDocument,
  type DocState,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

export function DivisionDocumentForm({
  code,
  subDivisions,
}: {
  code: string;
  subDivisions: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState<DocState, FormData>(
    createDivisionDocument,
    undefined,
  );

  return (
    <Panel className="border-badge-500/30">
      <PanelHeader
        title="Diffuser un document"
        subtitle="Visible par la division ou par un peloton précis"
      />
      <form action={action} className="space-y-4 px-5 py-4">
        <input type="hidden" name="code" value={code} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titre">
            <Input name="title" required placeholder="Note de service…" />
          </Field>
          <Field label="Destinataires">
            <select name="subDivisionId" defaultValue="" className={inputClass}>
              <option value="">Toute la division</option>
              {subDivisions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Contenu">
          <textarea name="content" rows={5} required className={inputClass} />
        </Field>

        <Field label="Lien (optionnel)" hint="URL d'un document externe.">
          <Input name="fileUrl" placeholder="https://…" />
        </Field>

        <ActionFeedback error={state?.error} success={state?.success} />

        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" />
          {pending ? "Diffusion…" : "Diffuser"}
        </Button>
      </form>
    </Panel>
  );
}
