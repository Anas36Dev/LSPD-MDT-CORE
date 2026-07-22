"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { Badge, Button, Field, Input, Panel, PanelHeader } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import {
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  type FieldType,
  type ReportField,
  type TemplateSchema,
} from "@/lib/report-schema";
import {
  createTemplate,
  updateTemplate,
  type TemplateState,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

/** Types nécessitant une liste d'options saisie par le superviseur. */
const NEEDS_OPTIONS: FieldType[] = ["select", "multiselect"];

const slugKey = (label: string) =>
  label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "champ";

export type RankOption = { id: number; name: string; level: number };

export function TemplateEditor({
  mode,
  templateId,
  initial,
  ranks,
  currentVersion,
}: {
  mode: "create" | "edit";
  templateId?: number;
  initial: {
    name: string;
    description: string;
    category: string;
    referencePrefix: string;
    minRankLevel: number;
    requiresValidation: boolean;
    isActive: boolean;
    schema: TemplateSchema;
  };
  ranks: RankOption[];
  currentVersion?: number;
}) {
  const [state, action, pending] = useActionState<TemplateState, FormData>(
    mode === "create" ? createTemplate : updateTemplate,
    undefined,
  );

  const [sections, setSections] = useState<TemplateSchema>(
    initial.schema.length > 0
      ? initial.schema
      : [{ title: "Informations", fields: [] }],
  );

  const mutate = (fn: (draft: TemplateSchema) => void) =>
    setSections((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });

  const addSection = () =>
    mutate((d) => {
      d.push({ title: `Section ${d.length + 1}`, fields: [] });
    });

  const addField = (si: number) =>
    mutate((d) => {
      const n = d[si].fields.length + 1;
      d[si].fields.push({
        key: `champ_${si + 1}_${n}`,
        label: `Champ ${n}`,
        type: "text",
      });
    });

  const patchField = (si: number, fi: number, patch: Partial<ReportField>) =>
    mutate((d) => {
      d[si].fields[fi] = { ...d[si].fields[fi], ...patch };
    });

  const move = (si: number, fi: number, delta: number) =>
    mutate((d) => {
      const target = fi + delta;
      if (target < 0 || target >= d[si].fields.length) return;
      const [f] = d[si].fields.splice(fi, 1);
      d[si].fields.splice(target, 0, f);
    });

  return (
    <form action={action} className="space-y-6">
      {mode === "edit" ? (
        <input type="hidden" name="id" value={templateId} />
      ) : null}
      <input type="hidden" name="schema" value={JSON.stringify(sections)} />

      {/* --- Métadonnées --------------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Paramètres du modèle"
          subtitle={
            currentVersion
              ? `Version en vigueur : ${currentVersion}`
              : "Nouveau modèle"
          }
        />
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom du modèle">
              <Input name="name" defaultValue={initial.name} required />
            </Field>
            <Field
              label="Grade minimum requis"
              hint="Les agents d'un grade inférieur ne verront pas ce modèle."
            >
              <select
                name="minRankLevel"
                defaultValue={initial.minRankLevel}
                className={inputClass}
              >
                {ranks.map((r) => (
                  <option key={r.id} value={r.level}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Catégorie"
              hint="Détermine l'onglet où le modèle est proposé aux agents."
            >
              <select
                name="category"
                defaultValue={initial.category}
                className={inputClass}
              >
                <option value="REPORT">Rapport</option>
                <option value="COMPLAINT">Plainte / déposition</option>
              </select>
            </Field>
            <Field
              label="Préfixe de référence"
              hint="Ex: REPORT-ARREST → REPORT-ARREST-2026-0001."
            >
              <Input
                name="referencePrefix"
                defaultValue={initial.referencePrefix}
                placeholder="LSPD"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              name="description"
              rows={2}
              defaultValue={initial.description}
              className={inputClass}
            />
          </Field>

          <div className="flex flex-wrap gap-5">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                name="requiresValidation"
                defaultChecked={initial.requiresValidation}
                className="h-4 w-4 accent-[var(--color-badge-500)]"
              />
              <span className="text-sm text-mist-300">
                Soumettre à validation d&apos;un superviseur
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={initial.isActive}
                className="h-4 w-4 accent-[var(--color-badge-500)]"
              />
              <span className="text-sm text-mist-300">Modèle actif</span>
            </label>
          </div>
        </div>
      </Panel>

      {/* --- Sections et champs -------------------------------------------- */}
      {sections.map((section, si) => (
        <Panel key={si}>
          <div className="flex items-center gap-3 border-b border-ink-700 px-5 py-3">
            <input
              value={section.title}
              onChange={(e) =>
                mutate((d) => {
                  d[si].title = e.target.value;
                })
              }
              className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-mist-100 hover:border-ink-600 focus:border-badge-500 focus:outline-none"
              placeholder="Titre de la section"
            />
            <Badge tone="neutral">{section.fields.length} champ(s)</Badge>
            {sections.length > 1 ? (
              <button
                type="button"
                onClick={() =>
                  mutate((d) => {
                    d.splice(si, 1);
                  })
                }
                className="rounded-md p-1.5 text-mist-500 transition-colors hover:text-alert-500"
                title="Supprimer la section"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="space-y-3 px-5 py-4">
            {section.fields.map((field, fi) => (
              <div
                key={fi}
                className="rounded-lg border border-ink-700 bg-ink-850/50 p-3"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <span className="label-tag">Libellé</span>
                      <input
                        value={field.label}
                        onChange={(e) =>
                          patchField(si, fi, {
                            label: e.target.value,
                            // La clé technique suit le libellé tant qu'elle n'a
                            // pas été modifiée à la main.
                            key:
                              field.key === slugKey(field.label)
                                ? slugKey(e.target.value)
                                : field.key,
                          })
                        }
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                    <div>
                      <span className="label-tag">Type</span>
                      <select
                        value={field.type}
                        onChange={(e) =>
                          patchField(si, fi, {
                            type: e.target.value as FieldType,
                          })
                        }
                        className={`mt-1 ${inputClass}`}
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {FIELD_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-end gap-1">
                    <button
                      type="button"
                      onClick={() => move(si, fi, -1)}
                      disabled={fi === 0}
                      className="rounded-md p-1.5 text-mist-500 transition-colors hover:text-mist-100 disabled:opacity-30"
                      title="Monter"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(si, fi, 1)}
                      disabled={fi === section.fields.length - 1}
                      className="rounded-md p-1.5 text-mist-500 transition-colors hover:text-mist-100 disabled:opacity-30"
                      title="Descendre"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        mutate((d) => {
                          d[si].fields.splice(fi, 1);
                        })
                      }
                      className="rounded-md p-1.5 text-mist-500 transition-colors hover:text-alert-500"
                      title="Supprimer le champ"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {NEEDS_OPTIONS.includes(field.type) ? (
                  <div className="mt-3">
                    <span className="label-tag">
                      Options (une par ligne)
                    </span>
                    <textarea
                      rows={3}
                      value={(field.options ?? []).join("\n")}
                      onChange={(e) =>
                        patchField(si, fi, {
                          options: e.target.value
                            .split("\n")
                            .map((o) => o.trim())
                            .filter(Boolean),
                        })
                      }
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>
                ) : null}

                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <span className="label-tag">Aide affichée sous le champ</span>
                    <input
                      value={field.help ?? ""}
                      onChange={(e) =>
                        patchField(si, fi, { help: e.target.value || undefined })
                      }
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>
                  <label className="flex cursor-pointer items-end gap-2 pb-2.5">
                    <input
                      type="checkbox"
                      checked={field.required ?? false}
                      onChange={(e) =>
                        patchField(si, fi, { required: e.target.checked })
                      }
                      className="h-4 w-4 accent-[var(--color-badge-500)]"
                    />
                    <span className="text-sm text-mist-300">Obligatoire</span>
                  </label>
                </div>

                <p className="mt-2 font-mono text-[0.68rem] text-mist-500">
                  clé : {field.key}
                </p>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addField(si)}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-ink-600 px-3 py-2 text-xs text-mist-500 transition-colors hover:border-badge-500/50 hover:text-mist-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter un champ
            </button>
          </div>
        </Panel>
      ))}

      <button
        type="button"
        onClick={addSection}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink-600 px-4 py-3 text-sm text-mist-500 transition-colors hover:border-badge-500/50 hover:text-mist-100"
      >
        <Plus className="h-4 w-4" />
        Ajouter une section
      </button>

      <ActionFeedback error={state?.error} success={state?.success} />
      <ActionFeedback success={state?.success} />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Enregistrement…"
            : mode === "create"
              ? "Créer le modèle"
              : "Publier les modifications"}
        </Button>
        <span className="text-xs text-mist-500">
          Modifier la structure publie une nouvelle version. Les rapports déjà
          rédigés conservent la leur.
        </span>
      </div>
    </form>
  );
}
