"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";

import { Button, Field, Input, Panel, PanelHeader } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import {
  createAcademyDocument,
  type AcademyDocState,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

export function AcademyDocumentForm() {
  const [state, action, pending] = useActionState<AcademyDocState, FormData>(
    createAcademyDocument,
    undefined,
  );

  return (
    <Panel className="border-badge-500/30">
      <PanelHeader
        title="Publier un document"
        subtitle="Support pédagogique pour l'académie"
      />
      <form action={action} className="space-y-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titre">
            <Input name="title" required placeholder="Manuel du Rookie…" />
          </Field>
          <Field label="Visibilité">
            <select name="visibility" defaultValue="ALL" className={inputClass}>
              <option value="ALL">Rookies et instructeurs</option>
              <option value="INSTRUCTORS">Instructeurs uniquement</option>
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
          {pending ? "Publication…" : "Publier"}
        </Button>
      </form>
    </Panel>
  );
}
