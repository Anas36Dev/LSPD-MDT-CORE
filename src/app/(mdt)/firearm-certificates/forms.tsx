"use client";

import { useActionState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import {
  issueCertificate,
  revokeCertificate,
  type FscState,
} from "./actions";

function Feedback({ state }: { state: FscState }) {
  return (
    <ActionFeedback error={state?.error} success={state?.success} />
  );
}

export function IssueForm() {
  const [state, action, pending] = useActionState<FscState, FormData>(
    issueCertificate,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titulaire (prénom et nom)">
          <Input name="subjectName" required placeholder="John Doe" />
        </Field>

        <Field label="Date d'expiration" hint="Laisser vide si sans limite.">
          <Input name="expiresAt" type="date" />
        </Field>
      </div>

      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Délivrance…" : "Délivrer le certificat"}
      </Button>
    </form>
  );
}

export function RevokeForm({ certificateId }: { certificateId: number }) {
  const [state, action, pending] = useActionState<FscState, FormData>(
    revokeCertificate,
    undefined,
  );

  return (
    <form action={action} className="mt-2 flex flex-wrap items-start gap-2">
      <input type="hidden" name="certificateId" value={certificateId} />
      <input
        name="revokeReason"
        placeholder="Motif de la révocation"
        className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-850 px-3 py-1.5 text-xs text-mist-100 focus:border-alert-500 focus:outline-none"
        required
      />
      <Button
        type="submit"
        variant="danger"
        className="px-3 py-1.5 text-xs"
        disabled={pending}
      >
        {pending ? "…" : "Révoquer"}
      </Button>
      <div className="w-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}
