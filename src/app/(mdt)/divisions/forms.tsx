"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Lock, Plus, Trash2, X } from "lucide-react";

import { Badge, Button, Field, Input, Panel, PanelHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { ActionFeedback } from "@/components/action-feedback";
import {
  createDivision,
  createDivisionRole,
  createSubDivision,
  deleteDivision,
  deleteDivisionRole,
  deleteSubDivision,
  reorderDivision,
  updateDivision,
  type DivisionState,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

export type RankOption = { level: number; name: string };
export type SubDivisionView = { id: number; code: string; name: string };
export type RoleView = {
  id: number;
  code: string;
  name: string;
  isDivisionChief: boolean;
  isUnitLead: boolean;
  canTrain: boolean;
  subDivisionName: string | null;
};
export type DivisionView = {
  id: number;
  code: string;
  name: string;
  shortName: string;
  isRestricted: boolean;
  minRankLevel: number;
  memberCount: number;
  subDivisions: SubDivisionView[];
  roles: RoleView[];
  isFirst: boolean;
  isLast: boolean;
};

function Feedback({ state }: { state: DivisionState }) {
  return (
    <ActionFeedback error={state?.error} success={state?.success} />
  );
}

function RankSelect({
  ranks,
  defaultValue,
}: {
  ranks: RankOption[];
  defaultValue?: number;
}) {
  return (
    <select name="minRankLevel" defaultValue={defaultValue} className={inputClass}>
      {ranks.map((r) => (
        <option key={r.level} value={r.level}>
          {r.name}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Création d'une division
// ---------------------------------------------------------------------------

export function DivisionsHeader({
  ranks,
  title,
  subtitle,
}: {
  ranks: RankOption[];
  title: string;
  subtitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DivisionState, FormData>(
    createDivision,
    undefined,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">{title}</h1>
          <p className="mt-1 text-sm text-mist-500">{subtitle}</p>
        </div>
        {!open ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Ajouter une division
          </Button>
        ) : null}
      </div>

      {open ? (
        <Panel className="border-badge-500/30">
          <PanelHeader
            title="Nouvelle division"
            action={
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-mist-500 hover:text-mist-100"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            }
          />
          <form action={action} className="space-y-4 px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom complet">
                <Input name="name" required placeholder="Air Support Division" />
              </Field>
              <Field label="Sigle" hint="Affiché sur les badges. Défaut : le nom.">
                <Input name="shortName" placeholder="Air Support" />
              </Field>
            </div>
            <Field
              label="Grade minimum d'accès"
              hint="Grade requis pour être affecté à cette division."
            >
              <RankSelect ranks={ranks} defaultValue={38} />
            </Field>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                name="isRestricted"
                className="h-4 w-4 accent-[var(--color-badge-500)]"
              />
              <span className="text-sm text-mist-300">
                Cloisonnée — dossiers visibles uniquement par ses membres et le
                Command Staff
              </span>
            </label>
            <Feedback state={state} />
            <Button type="submit" disabled={pending}>
              {pending ? "Création…" : "Créer la division"}
            </Button>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carte d'une division existante
// ---------------------------------------------------------------------------

export function DivisionCard({
  division,
  ranks,
}: {
  division: DivisionView;
  ranks: RankOption[];
}) {
  const [editing, setEditing] = useState(false);
  const rankName =
    ranks.find((r) => r.level === division.minRankLevel)?.name ?? "—";

  return (
    <Panel>
      <PanelHeader
        title={division.name}
        subtitle={`${division.shortName} · ${division.code}`}
        action={
          <div className="flex items-center gap-1.5">
            <form action={reorderDivision}>
              <input type="hidden" name="id" value={division.id} />
              <input type="hidden" name="direction" value="up" />
              <button
                type="submit"
                disabled={division.isFirst}
                className="rounded p-1 text-mist-500 hover:text-mist-100 disabled:opacity-30"
                aria-label="Monter"
              >
                <ChevronDown className="h-4 w-4 rotate-180" />
              </button>
            </form>
            <form action={reorderDivision}>
              <input type="hidden" name="id" value={division.id} />
              <input type="hidden" name="direction" value="down" />
              <button
                type="submit"
                disabled={division.isLast}
                className="rounded p-1 text-mist-500 hover:text-mist-100 disabled:opacity-30"
                aria-label="Descendre"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </form>
            <button
              onClick={() => setEditing((v) => !v)}
              className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-100 hover:bg-ink-700"
            >
              {editing ? "Fermer" : "Modifier"}
            </button>
            <ConfirmButton
              action={deleteDivision}
              fields={{ id: division.id }}
              title="Supprimer la division"
              message={`Supprimer « ${division.name} » ? ${division.memberCount} agent(s) y seront détaché(s). Cette action est irréversible.`}
              confirmLabel="Supprimer"
              triggerTitle="Supprimer la division"
              triggerClassName="rounded-md p-1 text-mist-500 hover:text-alert-500"
              trigger={<Trash2 className="h-4 w-4" />}
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-ink-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-mist-500">Accès dès</span>
          <Badge tone="blue">{rankName}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-mist-500">Effectif</span>
          <Badge tone="neutral">{division.memberCount} membre(s)</Badge>
        </div>
        {division.isRestricted ? (
          <Badge tone="amber">
            <Lock className="h-3 w-3" />
            Cloisonnée
          </Badge>
        ) : null}
      </div>

      {editing ? (
        <EditDivisionForm division={division} ranks={ranks} />
      ) : null}

      <div className="grid gap-5 border-t border-ink-700 px-5 py-4 md:grid-cols-2">
        <SubDivisionsManager division={division} />
        <RolesManager division={division} />
      </div>
    </Panel>
  );
}

function EditDivisionForm({
  division,
  ranks,
}: {
  division: DivisionView;
  ranks: RankOption[];
}) {
  const [state, action, pending] = useActionState<DivisionState, FormData>(
    updateDivision,
    undefined,
  );

  return (
    <form
      action={action}
      className="space-y-4 border-t border-ink-700 bg-ink-850/40 px-5 py-4"
    >
      <input type="hidden" name="id" value={division.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet">
          <Input name="name" defaultValue={division.name} required />
        </Field>
        <Field label="Sigle">
          <Input name="shortName" defaultValue={division.shortName} />
        </Field>
      </div>
      <Field label="Grade minimum d'accès">
        <RankSelect ranks={ranks} defaultValue={division.minRankLevel} />
      </Field>
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          name="isRestricted"
          defaultChecked={division.isRestricted}
          className="h-4 w-4 accent-[var(--color-badge-500)]"
        />
        <span className="text-sm text-mist-300">
          Cloisonnée — dossiers réservés aux membres et au Command Staff
        </span>
      </label>
      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sous-unités
// ---------------------------------------------------------------------------

function SubDivisionsManager({ division }: { division: DivisionView }) {
  const [state, action, pending] = useActionState<DivisionState, FormData>(
    createSubDivision,
    undefined,
  );

  return (
    <div className="space-y-3">
      <p className="label-tag">Sous-unités</p>
      {division.subDivisions.length === 0 ? (
        <p className="text-xs text-mist-500">Aucune sous-unité.</p>
      ) : (
        <ul className="space-y-1.5">
          {division.subDivisions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-md border border-ink-700 bg-ink-850/60 px-3 py-1.5"
            >
              <span className="text-sm text-mist-100">{s.name}</span>
              <ConfirmButton
                action={deleteSubDivision}
                fields={{ subDivisionId: s.id }}
                title="Supprimer la sous-unité"
                message={`Supprimer la sous-unité « ${s.name} » ?`}
                confirmLabel="Supprimer"
                triggerTitle="Supprimer"
                triggerClassName="rounded p-0.5 text-mist-500 hover:text-alert-500"
                trigger={<X className="h-3.5 w-3.5" />}
              />
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="flex gap-2">
        <input type="hidden" name="divisionId" value={division.id} />
        <Input name="name" placeholder="Nouvelle sous-unité…" className="text-sm" />
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          className="shrink-0 px-3 py-2"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </form>
      <ActionFeedback error={state?.error} success={state?.success} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rôles internes
// ---------------------------------------------------------------------------

function RolesManager({ division }: { division: DivisionView }) {
  const [state, action, pending] = useActionState<DivisionState, FormData>(
    createDivisionRole,
    undefined,
  );
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-3">
      <p className="label-tag">Rôles internes</p>
      {division.roles.length === 0 ? (
        <p className="text-xs text-mist-500">Aucun rôle défini.</p>
      ) : (
        <ul className="space-y-1.5">
          {division.roles.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-2 rounded-md border border-ink-700 bg-ink-850/60 px-3 py-1.5"
            >
              <div className="min-w-0">
                <p className="text-sm text-mist-100">{r.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.isDivisionChief ? (
                    <Badge tone="gold">Chef de division</Badge>
                  ) : null}
                  {r.isUnitLead ? <Badge tone="blue">Chef d&apos;unité</Badge> : null}
                  {r.canTrain ? <Badge tone="green">Formateur</Badge> : null}
                  {r.subDivisionName ? (
                    <Badge tone="neutral">{r.subDivisionName}</Badge>
                  ) : null}
                </div>
              </div>
              <ConfirmButton
                action={deleteDivisionRole}
                fields={{ roleId: r.id }}
                title="Supprimer le rôle"
                message={`Supprimer le rôle « ${r.name} » ?`}
                confirmLabel="Supprimer"
                triggerTitle="Supprimer"
                triggerClassName="rounded p-0.5 text-mist-500 hover:text-alert-500"
                trigger={<X className="h-3.5 w-3.5" />}
              />
            </li>
          ))}
        </ul>
      )}

      {showAdd ? (
        <form
          action={action}
          className="space-y-2.5 rounded-lg border border-ink-700 bg-ink-850/40 p-3"
        >
          <input type="hidden" name="divisionId" value={division.id} />
          <Input name="name" placeholder="Nom du rôle…" required className="text-sm" />
          {division.subDivisions.length > 0 ? (
            <select name="subDivisionId" defaultValue="" className={inputClass}>
              <option value="">Toute la division</option>
              {division.subDivisions.map((s) => (
                <option key={s.id} value={s.id}>
                  Rattaché à : {s.name}
                </option>
              ))}
            </select>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-mist-300">
              <input type="checkbox" name="isDivisionChief" className="h-3.5 w-3.5 accent-[var(--color-gold-500)]" />
              Chef de division (autorité sur tout le périmètre)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-mist-300">
              <input type="checkbox" name="isUnitLead" className="h-3.5 w-3.5 accent-[var(--color-badge-500)]" />
              Chef d&apos;unité (autorité limitée à sa sous-unité)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-mist-300">
              <input type="checkbox" name="canTrain" className="h-3.5 w-3.5 accent-[var(--color-ok-500)]" />
              Peut former et évaluer des recrues
            </label>
          </div>
          <Feedback state={state} />
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" disabled={pending} className="text-xs">
              {pending ? "Ajout…" : "Ajouter le rôle"}
            </Button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-xs text-mist-500 hover:text-mist-100"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowAdd(true)}
          className="px-3 py-2 text-xs"
        >
          <Plus className="h-4 w-4" />
          Ajouter un rôle
        </Button>
      )}
    </div>
  );
}
