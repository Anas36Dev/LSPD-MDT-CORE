"use client";

import { useActionState } from "react";

import { Button, Field } from "@/components/ui";
import { SignatureField } from "@/components/signature-field";
import { ActionFeedback } from "@/components/action-feedback";
import { reviewReport, type ReportState } from "../actions";

const textareaClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

export function ReviewForm({
  reportId,
  signature,
}: {
  reportId: number;
  signature: string;
}) {
  const [state, action, pending] = useActionState<ReportState, FormData>(
    reviewReport,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <input type="hidden" name="id" value={reportId} />

      <Field
        label="Commentaire"
        hint="Obligatoire en cas de refus ou de demande de correction."
      >
        <textarea name="comment" rows={3} className={textareaClass} />
      </Field>

      <SignatureField
        signature={signature}
        label="Signature du superviseur"
        hint="Obligatoire pour valider officiellement le rapport."
      />

      <ActionFeedback error={state?.error} success={state?.success} />
      <ActionFeedback success={state?.success} />

      <div className="flex flex-wrap gap-2.5">
        <Button
          type="submit"
          name="decision"
          value="APPROVED"
          disabled={pending}
        >
          Valider
        </Button>
        <Button
          type="submit"
          name="decision"
          value="CHANGES_REQUESTED"
          variant="secondary"
          disabled={pending}
        >
          Demander une correction
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
