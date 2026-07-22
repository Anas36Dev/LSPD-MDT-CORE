"use client";

import { useActionState, useState } from "react";

import { Badge, Button, Field, Input, Panel, PanelHeader } from "@/components/ui";
import { SignatureField } from "@/components/signature-field";
import { ActionFeedback } from "@/components/action-feedback";
import {
  computeSentence,
  LAWYER_REDUCTIONS,
  MAX_OFFICER_REDUCTION,
  type LawyerKind,
  type PenalEntry,
  type ReportData,
  type ReportField,
  type TemplateSchema,
} from "@/lib/report-schema";
import { createReport, updateReport, type ReportState } from "./actions";

export type OfficerOption = { id: number; label: string };

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 placeholder:text-mist-500/70 focus:border-badge-500 focus:outline-none";

// ---------------------------------------------------------------------------
// Rendu d'un champ
// ---------------------------------------------------------------------------

function FieldRenderer({
  field,
  value,
  officers,
  civilians,
  vehicles,
}: {
  field: ReportField;
  value: unknown;
  officers: OfficerOption[];
  civilians: OfficerOption[];
  vehicles: OfficerOption[];
}) {
  const name = `f_${field.key}`;
  const str = value == null ? "" : String(value);
  const list = Array.isArray(value) ? value.map(String) : [];

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          name={name}
          rows={5}
          defaultValue={str}
          className={inputClass}
          placeholder={field.help}
        />
      );

    case "number":
      return <Input name={name} type="number" defaultValue={str} />;

    case "date":
      return <Input name={name} type="date" defaultValue={str} />;

    case "datetime":
      return <Input name={name} type="datetime-local" defaultValue={str} />;

    case "checkbox":
      return (
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            name={name}
            defaultChecked={value === true}
            className="h-4 w-4 accent-[var(--color-badge-500)]"
          />
          <span className="text-sm text-mist-300">Oui</span>
        </label>
      );

    case "select":
      return (
        <select name={name} defaultValue={str} className={inputClass}>
          <option value="">— Choisir —</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );

    case "multiselect":
      return (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {(field.options ?? []).map((o) => (
            <label
              key={o}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-850/60 px-3 py-2"
            >
              <input
                type="checkbox"
                name={name}
                value={o}
                defaultChecked={list.includes(o)}
                className="h-4 w-4 accent-[var(--color-badge-500)]"
              />
              <span className="text-sm text-mist-100">{o}</span>
            </label>
          ))}
        </div>
      );

    case "officer_picker":
      return (
        <select
          name={name}
          multiple
          defaultValue={list}
          size={Math.min(6, Math.max(3, officers.length))}
          className={inputClass}
        >
          {officers.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.label}
            </option>
          ))}
        </select>
      );

    // Sélection dans la base civils, avec repli en saisie libre : un suspect
    // non encore fiché (« sous X ») doit rester consignable immédiatement.
    case "civilian_picker":
    case "vehicle_picker": {
      const options = field.type === "civilian_picker" ? civilians : vehicles;
      const listId = `list_${field.key}`;
      return (
        <>
          <Input
            name={name}
            defaultValue={str}
            list={options.length > 0 ? listId : undefined}
            placeholder={
              field.type === "civilian_picker"
                ? "Nom et prénom, ou « sous X » si non identifié"
                : "Plaque d'immatriculation"
            }
          />
          {options.length > 0 ? (
            <datalist id={listId}>
              {options.map((o) => (
                <option key={o.id} value={o.label} />
              ))}
            </datalist>
          ) : null}
        </>
      );
    }

    case "signature":
      return (
        <Input name={name} defaultValue={str} placeholder="Nom et matricule" />
      );

    default:
      return <Input name={name} defaultValue={str} placeholder={field.help} />;
  }
}

// ---------------------------------------------------------------------------
// Chefs d'inculpation + calcul de peine
// ---------------------------------------------------------------------------

function ChargesField({
  field,
  value,
  penalCodes,
}: {
  field: ReportField;
  value: unknown;
  penalCodes: PenalEntry[];
}) {
  const initial = Array.isArray(value) ? value.map(String) : [];
  const [selected, setSelected] = useState<string[]>(initial);
  const [officerReduction, setOfficerReduction] = useState(0);
  const [lawyer, setLawyer] = useState<LawyerKind>("NONE");

  const charges = penalCodes.filter((p) => selected.includes(p.code));
  const sentence = computeSentence(charges, { officerReduction, lawyer });

  const toggle = (code: string) =>
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  return (
    <div className="space-y-4">
      <div className="max-h-64 overflow-y-auto rounded-lg border border-ink-700">
        {penalCodes.map((p) => (
          <label
            key={p.code}
            className="flex cursor-pointer items-center gap-3 border-b border-ink-700 px-3 py-2 last:border-0 hover:bg-ink-800/50"
          >
            <input
              type="checkbox"
              name={`f_${field.key}`}
              value={p.code}
              checked={selected.includes(p.code)}
              onChange={() => toggle(p.code)}
              className="h-4 w-4 shrink-0 accent-[var(--color-badge-500)]"
            />
            <span className="w-24 shrink-0 font-mono text-xs text-badge-300">
              {p.code}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-mist-100">
              {p.title}
            </span>
            {p.requiresDoj ? (
              <span className="shrink-0 text-[0.62rem] font-semibold text-gold-500">
                DOJ
              </span>
            ) : null}
            <span className="shrink-0 text-xs text-mist-500">
              {p.fine != null ? `${p.fine.toLocaleString("fr-FR")} $` : "—"}
              {p.isLifeSentence
                ? " · perpétuité"
                : p.jailTime
                  ? ` · ${p.jailTime} min`
                  : ""}
            </span>
          </label>
        ))}
      </div>

      {charges.length > 0 ? (
        <div className="rounded-lg border border-ink-700 bg-ink-850/60 p-4">
          <p className="label-tag mb-3">Calcul de la peine</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={`Remise de l'agent (max ${MAX_OFFICER_REDUCTION} min)`}
              hint="Selon la coopération du suspect."
            >
              <Input
                type="number"
                min={0}
                max={MAX_OFFICER_REDUCTION}
                value={officerReduction}
                onChange={(e) =>
                  setOfficerReduction(Math.min(MAX_OFFICER_REDUCTION, Math.max(0, Number(e.target.value) || 0)))
                }
              />
            </Field>

            <Field label="Avocat">
              <select
                value={lawyer}
                onChange={(e) => setLawyer(e.target.value as LawyerKind)}
                className={inputClass}
              >
                {Object.entries(LAWYER_REDUCTIONS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                    {v.rate > 0 ? ` (−${Math.round(v.rate * 100)} %)` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <dl className="mt-4 space-y-1.5 border-t border-ink-700 pt-3 text-sm">
            <Line label="Amendes cumulées">
              {sentence.totalFine.toLocaleString("fr-FR")} $
            </Line>
            <Line label="Peine retenue (la plus longue)">
              {sentence.isLifeSentence ? (
                <span className="font-semibold text-alert-500">Perpétuité</span>
              ) : (
                `${sentence.jailTime} min`
              )}
              {sentence.longestCharge ? (
                <span className="text-mist-500"> · {sentence.longestCharge}</span>
              ) : null}
            </Line>
            {sentence.officerReduction > 0 ? (
              <Line label="Remise de l'agent">
                −{sentence.officerReduction} min
              </Line>
            ) : null}
            {sentence.lawyerReduction > 0 ? (
              <Line label="Remise de l'avocat">
                −{sentence.lawyerReduction} min
              </Line>
            ) : null}
            <div className="flex justify-between border-t border-ink-700 pt-2 font-semibold text-mist-100">
              <dt>Peine finale</dt>
              <dd>
                {sentence.isLifeSentence
                  ? "Perpétuité"
                  : `${sentence.finalJailTime} min`}
              </dd>
            </div>
          </dl>

          {/* Ces règles viennent directement des fiches circulaires et du
              code pénal de l'État de San Andreas. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {sentence.isLifeSentence ? (
              <Badge tone="red">
                Perpétuité — aucune remise applicable
              </Badge>
            ) : null}
            {sentence.requiresDoj ? (
              <Badge tone="gold">
                Affaire relevant du Department of Justice
              </Badge>
            ) : null}
            {sentence.requiresCommandApproval ? (
              <Badge tone="amber">
                Accord du Command Staff requis (peine &gt; 10 min)
              </Badge>
            ) : null}
            {sentence.requiresFederalConvoy ? (
              <Badge tone="red">Convoi fédéral obligatoire (≥ 60 min)</Badge>
            ) : null}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-mist-500">
            Les amendes sont cumulables, les peines de prison ne le sont pas :
            c&apos;est toujours la plus longue qui prime.
          </p>
        </div>
      ) : null}
    </div>
  );
}

const Line = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex justify-between text-mist-300">
    <dt>{label}</dt>
    <dd className="text-mist-100">{children}</dd>
  </div>
);

// ---------------------------------------------------------------------------
// Formulaire complet
// ---------------------------------------------------------------------------

export function ReportForm({
  mode,
  templateId,
  reportId,
  templateName,
  schema,
  data,
  title,
  location,
  officers,
  civilians,
  vehicles,
  penalCodes,
  requiresValidation,
  signature,
}: {
  mode: "create" | "edit";
  templateId?: number;
  reportId?: number;
  templateName: string;
  schema: TemplateSchema;
  data: ReportData;
  title: string;
  location: string;
  officers: OfficerOption[];
  civilians: OfficerOption[];
  vehicles: OfficerOption[];
  penalCodes: PenalEntry[];
  requiresValidation: boolean;
  signature: string;
}) {
  const [state, action, pending] = useActionState<ReportState, FormData>(
    mode === "create" ? createReport : updateReport,
    undefined,
  );

  return (
    <form action={action} className="space-y-6">
      {mode === "create" ? (
        <input type="hidden" name="templateId" value={templateId} />
      ) : (
        <input type="hidden" name="id" value={reportId} />
      )}

      <Panel>
        <PanelHeader title="Informations générales" subtitle={templateName} />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Titre du rapport">
            <Input name="title" defaultValue={title} required />
          </Field>
          <Field label="Lieu">
            <Input name="location" defaultValue={location} />
          </Field>
        </div>
      </Panel>

      {schema.map((section) => (
        <Panel key={section.title}>
          <PanelHeader title={section.title} />
          <div className="space-y-4 px-5 py-4">
            {section.fields.map((field) => (
              <Field
                key={field.key}
                label={`${field.label}${field.required ? " *" : ""}`}
                hint={field.type === "textarea" ? undefined : field.help}
              >
                {field.type === "penal_code_picker" ? (
                  <ChargesField
                    field={field}
                    value={data[field.key]}
                    penalCodes={penalCodes}
                  />
                ) : (
                  <FieldRenderer
                    field={field}
                    value={data[field.key]}
                    officers={officers}
                    civilians={civilians}
                    vehicles={vehicles}
                  />
                )}
              </Field>
            ))}
          </div>
        </Panel>
      ))}

      <Panel>
        <PanelHeader
          title="Signature"
          subtitle="Obligatoire pour soumettre le document"
        />
        <div className="px-5 py-4">
          <SignatureField
            signature={signature}
            hint="En signant, vous attestez de l'exactitude des informations consignées."
          />
        </div>
      </Panel>

      <ActionFeedback error={state?.error} success={state?.success} />
      <ActionFeedback success={state?.success} />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          name="intent"
          value="draft"
          variant="secondary"
          disabled={pending}
        >
          Enregistrer le brouillon
        </Button>
        <Button type="submit" name="intent" value="submit" disabled={pending}>
          {pending
            ? "Envoi…"
            : requiresValidation
              ? "Soumettre à validation"
              : "Finaliser le rapport"}
        </Button>
      </div>
    </form>
  );
}
