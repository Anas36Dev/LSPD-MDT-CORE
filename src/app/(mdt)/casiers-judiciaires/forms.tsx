"use client";

import { useActionState, useState } from "react";
import { Link2, Plus, X } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import { SignatureField } from "@/components/signature-field";
import {
  addCriminalRecord,
  createCivilian,
  linkCivilianReport,
  updateCivilian,
  validateCivilian,
  type CivilState,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

function Feedback({ state }: { state: CivilState }) {
  return <ActionFeedback error={state?.error} success={state?.success} />;
}

// ---------------------------------------------------------------------------
// Fiche / casier judiciaire
// ---------------------------------------------------------------------------

export type CivilianDraft = {
  id?: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  gender: string;
  address: string;
  phone: string;
  height: string;
  weight: string;
  eyeColor: string;
  hairColor: string;
  hasTattoos: boolean;
  tattoosDescription: string;
  groupuscule: string;
  photoUrl: string;
  notes: string;
  isFlagged: boolean;
  flagReason: string;
};

export function CivilianForm({
  mode,
  initial,
  signature,
}: {
  mode: "create" | "edit";
  initial: CivilianDraft;
  /** Signature officielle de l'agent, requise pour créer le casier. */
  signature: string;
}) {
  const [state, action, pending] = useActionState<CivilState, FormData>(
    mode === "create" ? createCivilian : updateCivilian,
    undefined,
  );
  const [flagged, setFlagged] = useState(initial.isFlagged);
  const [tattoos, setTattoos] = useState(initial.hasTattoos);

  return (
    <form action={action} className="space-y-5">
      {mode === "edit" ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom">
          <Input name="firstName" defaultValue={initial.firstName} required />
        </Field>
        <Field label="Nom">
          <Input name="lastName" defaultValue={initial.lastName} required />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date de naissance">
          <Input
            name="dateOfBirth"
            type="date"
            defaultValue={initial.dateOfBirth}
          />
        </Field>
        <Field label="Lieu de naissance">
          <Input name="placeOfBirth" defaultValue={initial.placeOfBirth} />
        </Field>
        <Field label="Nationalité">
          <Input name="nationality" defaultValue={initial.nationality} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Genre">
          <select
            name="gender"
            defaultValue={initial.gender}
            className={inputClass}
          >
            <option value="">—</option>
            <option value="Homme">Homme</option>
            <option value="Femme">Femme</option>
          </select>
        </Field>
        <Field label="Téléphone">
          <Input name="phone" defaultValue={initial.phone} />
        </Field>
        <Field label="Adresse postale">
          <Input name="address" defaultValue={initial.address} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Taille">
          <Input name="height" defaultValue={initial.height} placeholder="180 cm" />
        </Field>
        <Field label="Poids">
          <Input name="weight" defaultValue={initial.weight} placeholder="75 kg" />
        </Field>
        <Field label="Yeux">
          <Input name="eyeColor" defaultValue={initial.eyeColor} />
        </Field>
        <Field label="Cheveux">
          <Input name="hairColor" defaultValue={initial.hairColor} />
        </Field>
      </div>

      <div className="rounded-lg border border-ink-700 bg-ink-850/40 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            name="hasTattoos"
            checked={tattoos}
            onChange={(e) => setTattoos(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-badge-500)]"
          />
          <span className="text-sm font-medium text-mist-200">
            Tatouages apparents
          </span>
        </label>
        {tattoos ? (
          <div className="mt-3">
            <Field label="Description des tatouages">
              <Input
                name="tattoosDescription"
                defaultValue={initial.tattoosDescription}
                placeholder="Emplacement, motif…"
              />
            </Field>
          </div>
        ) : null}
      </div>

      <Field
        label="Revendication d'un groupuscule"
        hint="Gang, faction ou groupuscule revendiqué par l'individu (texte libre)."
      >
        <Input name="groupuscule" defaultValue={initial.groupuscule} />
      </Field>

      <Field
        label="Photo de l'individu (lien)"
        hint="Collez un lien vers une image (Discord, Imgur, ou tout autre hébergeur). Le lien doit pointer directement vers l'image."
      >
        <Input
          name="photoUrl"
          defaultValue={initial.photoUrl}
          placeholder="https://…/photo.png"
        />
      </Field>

      <Field label="Observations">
        <textarea
          name="notes"
          rows={3}
          defaultValue={initial.notes}
          className={inputClass}
        />
      </Field>

      <div className="rounded-lg border border-alert-500/30 bg-alert-600/5 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            name="isFlagged"
            checked={flagged}
            onChange={(e) => setFlagged(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-alert-500)]"
          />
          <span className="text-sm font-medium text-alert-500">
            Signaler comme dangereux
          </span>
        </label>
        {flagged ? (
          <div className="mt-3">
            <Field
              label="Motif du signalement"
              hint="Affiché en tête de casier à tout agent qui le consulte."
            >
              <Input name="flagReason" defaultValue={initial.flagReason} required />
            </Field>
          </div>
        ) : null}
      </div>

      {mode === "create" ? (
        <SignatureField
          signature={signature}
          hint="Le casier est un document officiel : signez-le pour l'enregistrer."
        />
      ) : null}

      <Feedback state={state} />

      <Button type="submit" disabled={pending}>
        {pending
          ? "Enregistrement…"
          : mode === "create"
            ? "Créer le casier"
            : "Enregistrer"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Validation superviseur
// ---------------------------------------------------------------------------

export function ValidateCivilianForm({
  id,
  signature,
}: {
  id: number;
  signature: string;
}) {
  const [state, action, pending] = useActionState<CivilState, FormData>(
    validateCivilian,
    undefined,
  );

  return (
    <form action={action} className="space-y-3 px-5 py-4">
      <input type="hidden" name="id" value={id} />
      <SignatureField
        signature={signature}
        label="Validation du superviseur"
        hint="Signez pour valider officiellement ce casier."
      />
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Validation…" : "Valider le casier"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Rattacher un rapport au casier (niveau fiche)
// ---------------------------------------------------------------------------

export type ReportOption = { id: number; reference: string; title: string };

export function ReportLinkForm({
  civilianId,
  reportOptions,
}: {
  civilianId: number;
  reportOptions: ReportOption[];
}) {
  const [state, action, pending] = useActionState<CivilState, FormData>(
    linkCivilianReport,
    undefined,
  );

  return (
    <form
      action={action}
      className="space-y-3 border-t border-ink-700 px-5 py-4"
    >
      <input type="hidden" name="civilianId" value={civilianId} />
      <Field
        label="Rattacher un rapport"
        hint="Référence exacte du rapport (arrestation, interrogatoire…)."
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <input
              name="reportRef"
              list="report-refs"
              placeholder="REPORT-ARREST-2026-0001"
              className={inputClass}
              required
            />
            <datalist id="report-refs">
              {reportOptions.map((r) => (
                <option key={r.id} value={r.reference}>
                  {r.title}
                </option>
              ))}
            </datalist>
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={pending}
            className="shrink-0 px-3 py-2"
            title="Rattacher"
          >
            <Link2 className="h-4 w-4" />
          </Button>
        </div>
      </Field>
      <Feedback state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Infraction du casier
// ---------------------------------------------------------------------------

type PenalOption = {
  id: number;
  code: string;
  title: string;
  fine: number | null;
  jailTime: number | null;
  isLifeSentence: boolean;
};

export type RecordOption = {
  id: number;
  reference: string | null;
  description: string;
};

/** Met en forme une durée de détention en minutes : « 1 h 30 de détention ». */
function formatJail(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const duration = h > 0 ? (m > 0 ? `${h} h ${m}` : `${h} h`) : `${m} min`;
  return `${duration} de détention`;
}

/** Petite puce retirable réutilisée pour les motifs / rapports / renvois. */
function Chip({
  label,
  code,
  onRemove,
}: {
  label: string;
  code?: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-850 py-1 pr-1 pl-2.5 text-xs">
      {code ? <span className="font-mono text-badge-300">{code}</span> : null}
      <span className="text-mist-100">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-0.5 text-mist-500 transition-colors hover:text-alert-500"
        title="Retirer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export function CriminalRecordForm({
  civilianId,
  penalCodes,
  reportOptions,
  recordOptions,
}: {
  civilianId: number;
  penalCodes: PenalOption[];
  reportOptions: ReportOption[];
  recordOptions: RecordOption[];
}) {
  const [state, action, pending] = useActionState<CivilState, FormData>(
    addCriminalRecord,
    undefined,
  );

  const byId = new Map(penalCodes.map((p) => [p.id, p]));
  const reportById = new Map(reportOptions.map((r) => [r.id, r]));
  const reportByRef = new Map(reportOptions.map((r) => [r.reference, r]));
  const recordById = new Map(recordOptions.map((r) => [r.id, r]));

  const [selected, setSelected] = useState<number[]>([]);
  const [reports, setReports] = useState<number[]>([]);
  const [refs, setRefs] = useState<number[]>([]);
  const [reportRef, setReportRef] = useState("");

  // Peine et amende sont calculées à partir des motifs ; l'agent garde la main.
  const [sentence, setSentence] = useState("");
  const [fine, setFine] = useState("");
  const [sentenceTouched, setSentenceTouched] = useState(false);
  const [fineTouched, setFineTouched] = useState(false);

  function recompute(ids: number[]) {
    const chosen = ids.map((id) => byId.get(id)!).filter(Boolean);
    if (!sentenceTouched) {
      const hasLife = chosen.some((p) => p.isLifeSentence);
      const maxJail = chosen.reduce((m, p) => Math.max(m, p.jailTime ?? 0), 0);
      setSentence(hasLife ? "Perpétuité" : formatJail(maxJail));
    }
    if (!fineTouched) {
      const total = chosen.reduce((sum, p) => sum + (p.fine ?? 0), 0);
      setFine(total > 0 ? String(total) : "");
    }
  }

  function addMotif(id: number) {
    if (!id || selected.includes(id)) return;
    const next = [...selected, id];
    setSelected(next);
    recompute(next);
  }
  function addReportRef() {
    const r = reportByRef.get(reportRef.trim());
    setReportRef("");
    if (!r || reports.includes(r.id)) return;
    setReports([...reports, r.id]);
  }
  function addRef(id: number) {
    if (!id || refs.includes(id)) return;
    setRefs([...refs, id]);
  }

  const availableMotifs = penalCodes.filter((p) => !selected.includes(p.id));
  const availableRecords = recordOptions.filter((r) => !refs.includes(r.id));

  return (
    <form
      action={action}
      className="space-y-4 border-t border-ink-700 px-5 py-4"
    >
      <input type="hidden" name="civilianId" value={civilianId} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="penalCodeId" value={id} />
      ))}
      {reports.map((id) => (
        <input key={id} type="hidden" name="reportId" value={id} />
      ))}
      {refs.map((id) => (
        <input key={id} type="hidden" name="refRecordId" value={id} />
      ))}

      <Field
        label="Motif(s)"
        hint="Ajoutez une ou plusieurs infractions ; laissez vide pour un fait hors nomenclature."
      >
        <div className="space-y-2.5">
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selected.map((id) => {
                const p = byId.get(id);
                if (!p) return null;
                return (
                  <Chip
                    key={id}
                    code={p.code}
                    label={p.title}
                    onRemove={() => {
                      const next = selected.filter((x) => x !== id);
                      setSelected(next);
                      recompute(next);
                    }}
                  />
                );
              })}
            </div>
          ) : null}
          <select
            value=""
            onChange={(e) => {
              addMotif(Number(e.target.value));
              e.target.value = "";
            }}
            className={inputClass}
          >
            <option value="">+ Ajouter un motif…</option>
            {availableMotifs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.title}
              </option>
            ))}
          </select>
        </div>
      </Field>

      <Field label="Description des faits">
        <textarea name="description" rows={2} className={inputClass} required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date des faits">
          <Input name="occurredAt" type="date" />
        </Field>
        <Field label="Peine prononcée">
          <Input
            name="sentence"
            placeholder="60 min de détention"
            value={sentence}
            onChange={(e) => {
              setSentenceTouched(true);
              setSentence(e.target.value);
            }}
          />
        </Field>
        <Field label="Amende ($)">
          <Input
            name="fine"
            type="number"
            value={fine}
            onChange={(e) => {
              setFineTouched(true);
              setFine(e.target.value);
            }}
          />
        </Field>
      </div>

      <Field
        label="Rapports liés"
        hint="Rattachez les rapports d'arrestation, d'interrogatoire… par référence."
      >
        <div className="space-y-2.5">
          {reports.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {reports.map((id) => {
                const r = reportById.get(id);
                if (!r) return null;
                return (
                  <Chip
                    key={id}
                    code={r.reference}
                    label={r.title}
                    onRemove={() => setReports(reports.filter((x) => x !== id))}
                  />
                );
              })}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <input
                list="report-refs-infraction"
                value={reportRef}
                onChange={(e) => setReportRef(e.target.value)}
                placeholder="Référence du rapport…"
                className={inputClass}
              />
              <datalist id="report-refs-infraction">
                {reportOptions.map((r) => (
                  <option key={r.id} value={r.reference}>
                    {r.title}
                  </option>
                ))}
              </datalist>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={addReportRef}
              className="shrink-0 px-3 py-2"
              title="Ajouter le rapport"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Field>

      {recordOptions.length > 0 ? (
        <Field
          label="Renvoyer vers d'anciennes infractions"
          hint="Référencez des arrestations / infractions déjà au casier."
        >
          <div className="space-y-2.5">
            {refs.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {refs.map((id) => {
                  const r = recordById.get(id);
                  if (!r) return null;
                  return (
                    <Chip
                      key={id}
                      code={r.reference ?? undefined}
                      label={r.description.slice(0, 40)}
                      onRemove={() => setRefs(refs.filter((x) => x !== id))}
                    />
                  );
                })}
              </div>
            ) : null}
            <select
              value=""
              onChange={(e) => {
                addRef(Number(e.target.value));
                e.target.value = "";
              }}
              className={inputClass}
            >
              <option value="">+ Référencer une infraction…</option>
              {availableRecords.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.reference ? `${r.reference} — ` : ""}
                  {r.description.slice(0, 60)}
                </option>
              ))}
            </select>
          </div>
        </Field>
      ) : null}

      <Field label="Observations supplémentaires">
        <textarea name="observations" rows={2} className={inputClass} />
      </Field>

      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter au casier"}
      </Button>
    </form>
  );
}
