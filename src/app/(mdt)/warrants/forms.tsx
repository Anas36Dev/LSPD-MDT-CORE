"use client";

import { useActionState, useState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { SignatureField } from "@/components/signature-field";
import { ActionFeedback } from "@/components/action-feedback";
import { createBolo, createWarrant, type WarrantState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

export type Option = { id: number; label: string };

function Feedback({ state }: { state: WarrantState }) {
  return (
    <ActionFeedback error={state?.error} success={state?.success} />
  );
}

export function WarrantForm({ signature }: { signature: string }) {
  const [state, action, pending] = useActionState<WarrantState, FormData>(
    createWarrant,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Individu visé (prénom et nom)">
          <Input name="subjectName" required placeholder="John Doe" />
        </Field>

        <Field label="Type de mandat">
          <select name="type" className={inputClass}>
            <option value="ARREST">Mandat d&apos;arrêt</option>
            <option value="SEARCH">Mandat de perquisition</option>
          </select>
        </Field>
      </div>

      <Field label="Motif">
        <textarea name="reason" rows={2} className={inputClass} required />
      </Field>

      <SignatureField
        signature={signature}
        label="Signature de l'agent émetteur"
        hint="Obligatoire pour émettre le mandat."
      />

      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Émission…" : "Émettre le mandat"}
      </Button>
    </form>
  );
}

export function BoloForm({
  vehicles,
  signature,
}: {
  vehicles: Option[];
  signature: string;
}) {
  const [state, action, pending] = useActionState<WarrantState, FormData>(
    createBolo,
    undefined,
  );
  const [type, setType] = useState("PERSON");

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titre de l'avis">
          <Input name="title" required placeholder="Individu armé en fuite" />
        </Field>

        <Field label="Priorité">
          <select name="priority" className={inputClass} defaultValue="MEDIUM">
            <option value="LOW">Basse</option>
            <option value="MEDIUM">Moyenne</option>
            <option value="HIGH">Haute</option>
            <option value="CRITICAL">Critique</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Objet de l'avis">
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          >
            <option value="PERSON">Personne</option>
            <option value="VEHICLE">Véhicule</option>
            <option value="OTHER">Autre</option>
          </select>
        </Field>

        {type === "PERSON" ? (
          <Field label="Individu concerné (prénom et nom)">
            <Input name="subjectName" placeholder="John Doe" />
          </Field>
        ) : type === "VEHICLE" ? (
          <Field label="Véhicule concerné">
            <select name="vehicleId" className={inputClass}>
              <option value="">— Non enregistré —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      <Field label="Description">
        <textarea name="description" rows={3} className={inputClass} required />
      </Field>

      <SignatureField
        signature={signature}
        label="Signature de l'agent émetteur"
        hint="Obligatoire pour diffuser l'avis."
      />

      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Diffusion…" : "Diffuser l'avis"}
      </Button>
    </form>
  );
}
