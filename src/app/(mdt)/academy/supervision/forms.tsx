"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";

import { Badge, Button, Field, Input } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { ActionFeedback } from "@/components/action-feedback";
import {
  addEvaluation,
  assignPromotion,
  createPromotion,
  deletePromotion,
  graduateRookie,
  recordExam,
  type AcademyState,
} from "./actions";
import { PASS_THRESHOLD } from "./constants";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

function Feedback({ state }: { state: AcademyState }) {
  return (
    <ActionFeedback error={state?.error} success={state?.success} />
  );
}

export function PromotionManager({
  promotions,
}: {
  promotions: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState<AcademyState, FormData>(
    createPromotion,
    undefined,
  );

  return (
    <div className="space-y-4 px-5 py-4">
      {promotions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {promotions.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-850 py-1 pr-1 pl-2.5 text-xs text-mist-100"
            >
              {p.name}
              <ConfirmButton
                action={deletePromotion}
                fields={{ promotionId: p.id }}
                title="Supprimer la promotion"
                message={`Supprimer la promotion « ${p.name} » ?`}
                confirmLabel="Supprimer"
                triggerTitle="Supprimer"
                triggerClassName="rounded p-0.5 text-mist-500 transition-colors hover:text-alert-500"
                trigger={<X className="h-3.5 w-3.5" />}
              />
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-mist-500">Aucune promotion créée.</p>
      )}

      <form action={action} className="flex gap-2">
        <Input name="name" placeholder="Nouvelle promotion (ex. Promotion 2026-A)…" />
        <Button type="submit" disabled={pending} className="shrink-0">
          <Plus className="h-4 w-4" />
          {pending ? "…" : "Créer"}
        </Button>
      </form>
      <ActionFeedback error={state?.error} success={state?.success} />
    </div>
  );
}

export function AssignPromotionForm({
  rookieId,
  current,
  promotions,
}: {
  rookieId: number;
  current: string | null;
  promotions: string[];
}) {
  // Le nom courant peut ne plus figurer dans la liste (promotion supprimée) :
  // on l'ajoute alors comme option pour ne pas le perdre silencieusement.
  const options =
    current && !promotions.includes(current)
      ? [current, ...promotions]
      : promotions;

  return (
    <form action={assignPromotion}>
      <input type="hidden" name="rookieId" value={rookieId} />
      <select
        name="promotion"
        defaultValue={current ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-xs text-mist-100 focus:border-badge-500 focus:outline-none"
      >
        <option value="">Sans promotion</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </form>
  );
}

export function GraduateRookieButton({
  rookieId,
  admitted,
}: {
  rookieId: number;
  admitted: boolean;
}) {
  return (
    <ConfirmButton
      action={graduateRookie}
      fields={{ rookieId }}
      danger={false}
      disabled={!admitted}
      title="Valider la sortie d'académie"
      message="Le Rookie sera promu Police Officer I et affecté à la Patrol Division. Confirmer ?"
      confirmLabel="Valider la sortie"
      triggerClassName="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-badge-500/60 bg-badge-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-badge-600/30 transition-colors hover:bg-badge-500 disabled:cursor-not-allowed disabled:opacity-55"
      trigger="Valider la sortie → Police Officer I"
    />
  );
}

export function ExamForm({
  candidateId,
  subjects,
}: {
  candidateId: number;
  subjects: { id: number; name: string; maxPoints: number }[];
}) {
  const [state, action, pending] = useActionState<AcademyState, FormData>(
    recordExam,
    undefined,
  );
  const [scores, setScores] = useState<Record<number, number>>({});

  const maxPoints = subjects.reduce((s, x) => s + x.maxPoints, 0);
  const total = subjects.reduce((s, x) => s + (scores[x.id] || 0), 0);
  const pct = maxPoints > 0 ? Math.round((total / maxPoints) * 100) : 0;
  const note20 = Math.round((total / maxPoints) * 20 * 10) / 10;
  const passed = pct >= PASS_THRESHOLD;

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <input type="hidden" name="candidateId" value={candidateId} />

      <div className="space-y-2.5">
        {subjects.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <label className="flex-1 text-sm text-mist-200">{s.name}</label>
            <input
              type="number"
              name={`score_${s.id}`}
              min={0}
              max={s.maxPoints}
              step={0.5}
              defaultValue={0}
              onChange={(e) =>
                setScores((prev) => ({ ...prev, [s.id]: Number(e.target.value) || 0 }))
              }
              className="w-20 rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-1.5 text-right text-sm text-mist-100 focus:border-badge-500 focus:outline-none"
            />
            <span className="w-10 text-xs text-mist-500">/ {s.maxPoints}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-700 bg-ink-850/60 px-4 py-3">
        <span className="text-sm text-mist-300">
          Total : <span className="font-semibold text-mist-100">{total}</span> /{" "}
          {maxPoints}
        </span>
        <span className="text-sm text-mist-300">
          Note : <span className="font-semibold text-mist-100">{note20}</span> / 20
        </span>
        <span className="text-sm text-mist-300">
          Résultat : <span className="font-semibold text-mist-100">{pct}%</span>
        </span>
        <Badge tone={passed ? "green" : "red"}>
          {passed ? "Admis" : "Ajourné"} (seuil {PASS_THRESHOLD}%)
        </Badge>
      </div>

      <Field label="Commentaire d'examen (optionnel)">
        <textarea name="comment" rows={2} className={inputClass} />
      </Field>

      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer l'examen"}
      </Button>
    </form>
  );
}

export function EvaluationForm({ traineeId }: { traineeId: number }) {
  const [state, action, pending] = useActionState<AcademyState, FormData>(
    addEvaluation,
    undefined,
  );

  return (
    <form action={action} className="space-y-2 px-5 py-4">
      <input type="hidden" name="traineeId" value={traineeId} />
      <textarea
        name="comment"
        rows={2}
        placeholder="Observation sur le Rookie (visible des instructeurs et du Command Staff)…"
        className={inputClass}
      />
      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Enregistrement…" : "Ajouter l'observation"}
      </Button>
    </form>
  );
}
