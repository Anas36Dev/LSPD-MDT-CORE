"use client";

import { useState } from "react";

import { Button, Field } from "@/components/ui";
import type { PreviewSpec } from "@/lib/preview";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

type Option = { code: string; label: string; hint?: string };

function CheckGrid({
  name,
  options,
  selected,
}: {
  name: string;
  options: Option[];
  selected: string[];
}) {
  if (options.length === 0) {
    return <p className="text-xs text-mist-500">Aucune option.</p>;
  }
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {options.map((o) => (
        <label
          key={o.code}
          className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink-700 bg-ink-850/60 px-3 py-2 transition-colors hover:border-ink-600"
        >
          <input
            type="checkbox"
            name={name}
            value={o.code}
            defaultChecked={selected.includes(o.code)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-gold-500)]"
          />
          <span className="min-w-0">
            <span className="block text-sm text-mist-100">{o.label}</span>
            {o.hint ? (
              <span className="block text-xs text-mist-500">{o.hint}</span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  );
}

export function PreviewForm({
  ranks,
  divisions,
  divisionRoles,
  subDivisions,
  certifications,
  current,
}: {
  ranks: { code: string; name: string; level: number }[];
  divisions: { code: string; name: string }[];
  divisionRoles: Option[];
  subDivisions: Option[];
  certifications: Option[];
  current: PreviewSpec | null;
}) {
  const [expanded, setExpanded] = useState(
    Boolean(
      current &&
        (current.divisionCodes.length > 0 ||
          current.divisionRoleCodes.length > 0 ||
          current.certificationCodes.length > 0),
    ),
  );

  return (
    <div className="space-y-5 px-5 py-4">
      <Field
        label="Grade simulé"
        hint="C'est lui qui détermine l'essentiel des accès."
      >
        <select
          name="rankCode"
          defaultValue={current?.rankCode ?? "ROOKIE"}
          className={inputClass}
          required
        >
          {ranks.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-badge-300 transition-colors hover:text-badge-400"
      >
        {expanded
          ? "− Masquer les affectations et habilitations"
          : "+ Simuler aussi des affectations et habilitations"}
      </button>

      {expanded ? (
        <div className="space-y-5 border-t border-ink-700 pt-5">
          <div>
            <p className="label-tag mb-2">Divisions</p>
            <CheckGrid
              name="divisions"
              options={divisions.map((d) => ({ code: d.code, label: d.name }))}
              selected={current?.divisionCodes ?? []}
            />
          </div>

          <div>
            <p className="label-tag mb-2">Unités et sections</p>
            <CheckGrid
              name="subDivisions"
              options={subDivisions}
              selected={current?.subDivisionCodes ?? []}
            />
          </div>

          <div>
            <p className="label-tag mb-2">Fonctions internes</p>
            <CheckGrid
              name="divisionRoles"
              options={divisionRoles}
              selected={current?.divisionRoleCodes ?? []}
            />
          </div>

          <div>
            <p className="label-tag mb-2">Habilitations</p>
            <CheckGrid
              name="certifications"
              options={certifications}
              selected={current?.certificationCodes ?? []}
            />
          </div>

          <Field label="Appartenance syndicale">
            <select
              name="unionRole"
              defaultValue={current?.unionRole ?? ""}
              className={inputClass}
            >
              <option value="">Non adhérent</option>
              <option value="MEMBER">Adhérent</option>
              <option value="REPRESENTATIVE">Représentant Syndical</option>
            </select>
          </Field>
        </div>
      ) : null}

      <Button type="submit">
        {current ? "Changer de rôle simulé" : "Activer l'aperçu"}
      </Button>
    </div>
  );
}
