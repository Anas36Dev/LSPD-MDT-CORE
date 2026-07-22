"use client";

import { useActionState } from "react";
import { DatabaseZap } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import { wipeOperationalData, type WipeState } from "./actions";
import { WIPE_PHRASE } from "./constants";

export function WipeForm() {
  const [state, action, pending] = useActionState<WipeState, FormData>(
    wipeOperationalData,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <div className="rounded-lg border border-alert-500/30 bg-alert-600/10 px-4 py-3 text-xs leading-relaxed text-alert-500">
        Cette opération est <span className="font-semibold">irréversible</span>.
        Pour confirmer, saisissez{" "}
        <span className="font-mono font-semibold">{WIPE_PHRASE}</span> ci-dessous.
      </div>
      <Field label={`Confirmation — saisir « ${WIPE_PHRASE} »`}>
        <Input name="confirm" placeholder={WIPE_PHRASE} autoComplete="off" />
      </Field>

      <ActionFeedback error={state?.error} success={state?.success} />

      <Button type="submit" variant="danger" disabled={pending}>
        <DatabaseZap className="h-4 w-4" />
        {pending ? "Réinitialisation…" : "Réinitialiser les données"}
      </Button>
    </form>
  );
}
