"use client";

import { useActionState, useState } from "react";

import { Badge, Button, Field, Input, Panel, PanelHeader } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import {
  ACCOUNT_STATUSES,
  ACCOUNT_STATUS_MAP,
  BLOCKING_STATUSES,
} from "@/lib/account-status";
import { buildEmailClient } from "./email";
import {
  awardMedal,
  createAccount,
  deleteAccount,
  resetPassword,
  updateAssignments,
  updateCertifications,
  updateDiscord,
  updateIdentity,
  updateMedalCitation,
  updateStatus,
  type ActionState,
} from "./actions";

// ---------------------------------------------------------------------------
// Éléments partagés
// ---------------------------------------------------------------------------

function Feedback({ state }: { state: ActionState }) {
  return (
    <ActionFeedback error={state?.error} success={state?.success} />
  );
}

function Select({
  name,
  defaultValue,
  children,
}: {
  name: string;
  defaultValue?: string | number;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none"
    >
      {children}
    </select>
  );
}

function CheckGrid({
  name,
  options,
  selected,
}: {
  name: string;
  options: { id: number; label: string; hint?: string }[];
  selected: number[];
}) {
  if (options.length === 0) {
    return <p className="text-xs text-mist-500">Aucune option disponible.</p>;
  }
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {options.map((o) => (
        <label
          key={o.id}
          className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink-700 bg-ink-850/60 px-3 py-2 transition-colors hover:border-ink-600"
        >
          <input
            type="checkbox"
            name={name}
            value={o.id}
            defaultChecked={selected.includes(o.id)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-badge-500)]"
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

export type RankOption = { id: number; name: string; level: number };

// ---------------------------------------------------------------------------
// Création de compte
// ---------------------------------------------------------------------------

export function CreateAccountForm({
  ranks,
  promotions,
}: {
  ranks: RankOption[];
  promotions: string[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createAccount,
    undefined,
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const email = buildEmailClient(firstName, lastName);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom">
          <Input
            name="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </Field>
        <Field label="Nom">
          <Input
            name="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </Field>
      </div>

      <div className="rounded-lg border border-ink-700 bg-ink-850/60 px-3.5 py-3">
        <p className="label-tag">Identifiant de connexion généré</p>
        <p className="mt-1 font-mono text-sm text-badge-300">
          {email || "prenom.nom@lspd.core"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Matricule"
          hint="2 chiffres. Le numéro de badge en découle : matricule + 3 chiffres tirés au hasard (ex. 28 → 28597)."
        >
          <Input
            name="matricule"
            inputMode="numeric"
            maxLength={2}
            placeholder="28"
            required
          />
        </Field>
        <Field label="Grade">
          <Select name="rankId">
            {ranks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date de recrutement" hint="Détermine les années de service.">
          <Input name="recruitedAt" type="date" />
        </Field>
        <Field
          label="Identifiant Discord"
          hint="Optionnel — requis pour la connexion Discord."
        >
          <Input name="discordId" placeholder="285824752709533696" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Promotion académique"
          hint="Liste gérée depuis la supervision de l'académie — optionnel."
        >
          <Select name="promotion" defaultValue="">
            <option value="">Sans promotion</option>
            {promotions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Session de recrutement" hint="Optionnel.">
          <Input name="recruitmentSession" placeholder="Session #12" />
        </Field>
      </div>

      <Field
        label="Mot de passe"
        hint="Défini par vous. L'agent ne pourra jamais le modifier lui-même."
      >
        <Input name="password" type="text" minLength={8} required />
      </Field>

      <Feedback state={state} />

      <Button type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer le compte"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Identité et grade
// ---------------------------------------------------------------------------

export function IdentityForm({
  agent,
  ranks,
}: {
  agent: {
    id: number;
    firstName: string;
    lastName: string;
    matricule: string;
    badgeNumber: string;
    rankId: number;
    recruitedAt: string;
    phone: string | null;
  };
  ranks: RankOption[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateIdentity,
    undefined,
  );

  return (
    <Panel>
      <PanelHeader
        title="Identité et grade"
        subtitle="L'identifiant de connexion suit automatiquement le nom"
      />
      <form action={action} className="space-y-4 px-5 py-4">
        <input type="hidden" name="id" value={agent.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom">
            <Input name="firstName" defaultValue={agent.firstName} required />
          </Field>
          <Field label="Nom">
            <Input name="lastName" defaultValue={agent.lastName} required />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Matricule"
            hint={`Badge actuel : #${agent.badgeNumber}. Changer le matricule retire un nouveau badge.`}
          >
            <Input
              name="matricule"
              inputMode="numeric"
              maxLength={2}
              defaultValue={agent.matricule}
              required
            />
          </Field>
          <Field label="Grade">
            <Select name="rankId" defaultValue={agent.rankId}>
              {ranks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date de recrutement">
            <Input name="recruitedAt" type="date" defaultValue={agent.recruitedAt} />
          </Field>
          <Field label="Téléphone">
            <Input name="phone" defaultValue={agent.phone ?? ""} />
          </Field>
        </div>

        <Feedback state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Affectations
// ---------------------------------------------------------------------------

export function AssignmentsForm({
  agentId,
  divisions,
  subDivisions,
  roles,
  selected,
  blockedMessage,
}: {
  agentId: number;
  divisions: { id: number; label: string }[];
  subDivisions: { id: number; label: string; hint?: string }[];
  roles: { id: number; label: string; hint?: string }[];
  selected: {
    divisions: number[];
    subDivisions: number[];
    roles: number[];
    primary: number | null;
  };
  /**
   * Message affiché quand le grade restreint les divisions.
   * Null si l'agent peut porter au moins une division proposée.
   */
  blockedMessage: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateAssignments,
    undefined,
  );

  // Aucune division proposée (Rookie) : on n'affiche que le message.
  const noDivision = divisions.length === 0;

  return (
    <Panel>
      <PanelHeader
        title="Affectations"
        subtitle="Un agent peut servir dans plusieurs divisions et unités en parallèle"
      />
      <form action={action} className="space-y-5 px-5 py-4">
        <input type="hidden" name="id" value={agentId} />

        <div>
          <p className="label-tag mb-2">Divisions</p>
          {blockedMessage ? (
            <p className="mb-2 rounded-lg border border-warn-500/40 bg-warn-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-warn-500">
              {blockedMessage}
            </p>
          ) : null}
          {!noDivision ? (
            <CheckGrid
              name="divisions"
              options={divisions}
              selected={selected.divisions}
            />
          ) : null}
        </div>

        {!noDivision ? (
          <Field
            label="Division principale"
            hint="Celle affichée en premier sur le profil et dans la barre du haut."
          >
            <Select
              name="primaryDivision"
              defaultValue={selected.primary ?? undefined}
            >
              <option value="">— Aucune —</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div>
          <p className="label-tag mb-2">Unités et sections</p>
          <CheckGrid
            name="subDivisions"
            options={subDivisions}
            selected={selected.subDivisions}
          />
        </div>

        <div>
          <p className="label-tag mb-2">Fonctions internes</p>
          <CheckGrid name="roles" options={roles} selected={selected.roles} />
        </div>

        <Feedback state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les affectations"}
        </Button>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Certifications et syndicat
// ---------------------------------------------------------------------------

export function CertificationsForm({
  agentId,
  certifications,
  selected,
  unionRole,
}: {
  agentId: number;
  certifications: { id: number; label: string; hint?: string }[];
  selected: number[];
  unionRole: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateCertifications,
    undefined,
  );

  return (
    <Panel>
      <PanelHeader
        title="Certifications et syndicat"
        subtitle="PPA, Lincoln Patrol, habilitation IFSC"
      />
      <form action={action} className="space-y-5 px-5 py-4">
        <input type="hidden" name="id" value={agentId} />

        <CheckGrid
          name="certifications"
          options={certifications}
          selected={selected}
        />

        <Field label="Appartenance syndicale">
          <Select name="union" defaultValue={unionRole}>
            <option value="NONE">Non adhérent</option>
            <option value="MEMBER">Adhérent</option>
            <option value="REPRESENTATIVE">Représentant Syndical</option>
          </Select>
        </Field>

        <Feedback state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Médailles
// ---------------------------------------------------------------------------

/** Édition en ligne de la citation d'une médaille déjà décernée. */
export function MedalCitationForm({
  userMedalId,
  citation,
}: {
  userMedalId: number;
  citation: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateMedalCitation,
    undefined,
  );
  const [value, setValue] = useState(citation);
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`mt-0.5 block text-left text-xs transition-colors hover:text-badge-300 ${
          citation ? "text-mist-500" : "text-mist-500/60 italic"
        }`}
        title="Modifier la citation"
      >
        {citation || "Ajouter une citation…"}
      </button>
    );
  }

  return (
    <form action={action} className="mt-1 space-y-1.5">
      <input type="hidden" name="userMedalId" value={userMedalId} />
      <textarea
        name="citation"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-1.5 text-xs text-mist-100 focus:border-badge-500 focus:outline-none"
      />
      <ActionFeedback error={state?.error} success={state?.success} />
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" className="px-3 py-1 text-xs" disabled={pending}>
          {pending ? "…" : "Enregistrer"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="px-3 py-1 text-xs"
          onClick={() => {
            setValue(citation);
            setEditing(false);
          }}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}

export function MedalForm({
  agentId,
  medals,
}: {
  agentId: number;
  medals: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    awardMedal,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 border-t border-ink-700 px-5 py-4">
      <input type="hidden" name="id" value={agentId} />
      <Field label="Décerner une décoration">
        <Select name="medalId">
          <option value="">— Choisir —</option>
          {medals.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Citation justificative">
        <textarea
          name="citation"
          rows={2}
          className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none"
          placeholder="Motif de la décoration, visible publiquement sur le profil."
        />
      </Field>
      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Attribution…" : "Décerner"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Discord et avatar
// ---------------------------------------------------------------------------

export function DiscordForm({
  agent,
}: {
  agent: {
    id: number;
    discordId: string | null;
    discordUsername: string | null;
    manualAvatarUrl: string | null;
    avatarSource: string;
  };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateDiscord,
    undefined,
  );

  return (
    <Panel>
      <PanelHeader
        title="Discord et photo de profil"
        subtitle={
          agent.discordUsername
            ? `Compte lié : ${agent.discordUsername}`
            : "Aucun compte Discord rattaché"
        }
      />
      <form action={action} className="space-y-4 px-5 py-4">
        <input type="hidden" name="id" value={agent.id} />

        <Field
          label="Identifiant Discord"
          hint="Discord → Paramètres → Avancés → Mode développeur, puis clic droit sur la personne → Copier l'identifiant."
        >
          <Input name="discordId" defaultValue={agent.discordId ?? ""} />
        </Field>

        <Field label="Source de la photo de profil">
          <Select name="avatarSource" defaultValue={agent.avatarSource}>
            <option value="DISCORD">Photo Discord (automatique)</option>
            <option value="MANUAL">Photo imposée par un superviseur</option>
          </Select>
        </Field>

        <Field
          label="URL de la photo imposée"
          hint="Utilisée uniquement si la source est « imposée »."
        >
          <Input
            name="manualAvatarUrl"
            defaultValue={agent.manualAvatarUrl ?? ""}
            placeholder="https://…"
          />
        </Field>

        <Feedback state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Mot de passe et statut
// ---------------------------------------------------------------------------

export function PasswordForm({ agentId }: { agentId: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    resetPassword,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <input type="hidden" name="id" value={agentId} />
      <Field
        label="Nouveau mot de passe"
        hint="Communiquez-le à l'agent. Toutes ses sessions ouvertes seront fermées."
      >
        <Input name="password" type="text" minLength={8} required />
      </Field>
      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Application…" : "Redéfinir le mot de passe"}
      </Button>
    </form>
  );
}

export function StatusForm({
  agentId,
  status,
  canSuspend,
  isSelf = false,
}: {
  agentId: number;
  status: string;
  canSuspend: boolean;
  isSelf?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateStatus,
    undefined,
  );

  if (!canSuspend) {
    return (
      <div className="border-t border-ink-700 px-5 py-4">
        <p className="label-tag">Statut du compte</p>
        <div className="mt-1.5 flex items-center gap-2">
          <Badge tone={(ACCOUNT_STATUS_MAP[status] ?? ACCOUNT_STATUS_MAP.ACTIVE).tone}>
            {(ACCOUNT_STATUS_MAP[status] ?? ACCOUNT_STATUS_MAP.ACTIVE).label}
          </Badge>
          <span className="text-xs text-mist-500">
            Modifiable à partir du grade d&apos;Assistant Chief.
          </span>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 border-t border-ink-700 px-5 py-4">
      <input type="hidden" name="id" value={agentId} />
      <Field
        label="Statut du compte"
        hint={
          isSelf
            ? "Sur votre propre compte, la suspension et la radiation sont indisponibles : elles vous déconnecteraient sans retour possible."
            : "Suspendre ou radier ferme immédiatement toutes les sessions de l'agent."
        }
      >
        <Select name="status" defaultValue={status}>
          {ACCOUNT_STATUSES.filter(
            (s) => !isSelf || !BLOCKING_STATUSES.includes(s.value),
          ).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <Feedback state={state} />
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Application…" : "Appliquer le statut"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Suppression définitive (Chief of Police, agent ayant quitté l'effectif)
// ---------------------------------------------------------------------------

export function DeleteAccountForm({
  agentId,
  badgeNumber,
}: {
  agentId: number;
  badgeNumber: string;
}) {
  return (
    <Panel className="border-alert-500/40">
      <PanelHeader
        title="Supprimer définitivement le compte"
        subtitle="Action irréversible — retire l'agent et toutes ses données liées"
      />
      <form action={deleteAccount} className="space-y-4 px-5 py-4">
        <input type="hidden" name="id" value={agentId} />
        <div className="rounded-lg border border-alert-500/30 bg-alert-600/10 px-4 py-3 text-xs leading-relaxed text-alert-500">
          Cette opération est <span className="font-semibold">irréversible</span> et
          retire aussi les rapports, mandats, enquêtes et notes rédigés par l&apos;agent.
          Pour confirmer, saisissez le numéro de badge de l&apos;agent&nbsp;:{" "}
          <span className="font-mono font-semibold">#{badgeNumber}</span>.
        </div>
        <Field label="Confirmation — numéro de badge">
          <Input name="confirm" placeholder={badgeNumber} autoComplete="off" />
        </Field>
        <Button type="submit" variant="danger">
          Supprimer définitivement ce compte
        </Button>
      </form>
    </Panel>
  );
}
