"use client";

import { useEffect, useState, useTransition } from "react";
import { Crown, GripVertical, Radio, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  deletePatrol,
  moveAgent,
  reorderPatrols,
  setPatrolLead,
  updatePatrol,
} from "./actions";

export type AgentCard = {
  id: number;
  name: string;
  badgeNumber: string;
  rankName: string;
  isLead: boolean;
  avatarUrl: string | null;
};

export type PatrolCard = {
  id: number;
  callSign: string;
  number: string | null;
  status: string;
  sector: string | null;
  createdById: number | null;
  members: AgentCard[];
};

const PATROL_STATUS: Record<string, { label: string; tone: string }> = {
  AVAILABLE: { label: "Disponible", tone: "border-ok-500/40 text-ok-500" },
  BUSY: { label: "Occupée", tone: "border-warn-500/40 text-warn-500" },
  ON_SCENE: { label: "Sur intervention", tone: "border-alert-500/40 text-alert-500" },
  RETURNING: { label: "Retour au poste", tone: "border-ink-600 text-mist-300" },
};

// ---------------------------------------------------------------------------
// Statut et secteur d'une patrouille
// ---------------------------------------------------------------------------

/**
 * Contrôles édités par le dispatch ou par un membre de la patrouille.
 *
 * Statut et secteur sont pilotés par un état React, et non par des champs
 * non contrôlés : sinon, après un premier changement, la valeur affichée se
 * désynchronise de la valeur réelle et re-choisir la même option ne déclenche
 * plus rien.
 */
function PatrolControls({
  patrolId,
  status,
  sector,
  editable,
}: {
  patrolId: number;
  status: string;
  sector: string | null;
  editable: boolean;
}) {
  const [localStatus, setLocalStatus] = useState(status);
  const [localSector, setLocalSector] = useState(sector ?? "");
  const [, startTransition] = useTransition();

  // Se recale sur la valeur du serveur si elle change côté données.
  useEffect(() => setLocalStatus(status), [status]);
  useEffect(() => setLocalSector(sector ?? ""), [sector]);

  const submit = (fields: Record<string, string>) => {
    const data = new FormData();
    data.set("patrolId", String(patrolId));
    for (const [k, v] of Object.entries(fields)) data.set(k, v);
    startTransition(() => {
      void updatePatrol(data);
    });
  };

  const st = PATROL_STATUS[localStatus] ?? PATROL_STATUS.AVAILABLE;

  if (!editable) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[0.62rem] font-medium",
            st.tone,
          )}
        >
          {st.label}
        </span>
        {sector ? (
          <span className="truncate text-xs text-mist-500">{sector}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <select
        value={localStatus}
        onChange={(e) => {
          setLocalStatus(e.target.value);
          submit({ status: e.target.value });
        }}
        className={cn(
          "w-full rounded border bg-ink-850 px-1.5 py-1 text-xs font-medium focus:outline-none",
          st.tone,
        )}
      >
        {Object.entries(PATROL_STATUS).map(([k, v]) => (
          <option key={k} value={k} className="text-mist-100">
            {v.label}
          </option>
        ))}
      </select>

      <input
        value={localSector}
        onChange={(e) => setLocalSector(e.target.value)}
        onBlur={() => {
          if (localSector !== (sector ?? "")) submit({ sector: localSector });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder="Secteur…"
        className="w-full rounded border border-ink-600 bg-ink-850 px-1.5 py-1 text-xs text-mist-300 placeholder:text-mist-500/70 focus:border-badge-500 focus:outline-none"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carte d'agent
// ---------------------------------------------------------------------------

function Card({
  agent,
  movable,
  canLead,
  onDragStart,
  pending,
}: {
  agent: AgentCard;
  movable: boolean;
  canLead: boolean;
  onDragStart: (id: number) => void;
  pending: boolean;
}) {
  return (
    <div
      draggable={movable}
      onDragStart={(e) => {
        if (!movable) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(agent.id));
        onDragStart(agent.id);
      }}
      className={cn(
        "rounded-lg border transition-all",
        movable
          ? "cursor-grab border-badge-500/40 bg-badge-600/15 active:cursor-grabbing"
          : "cursor-not-allowed border-ink-700 bg-ink-850/60 opacity-70",
        pending && "opacity-50",
      )}
      title={
        movable
          ? "Glissez cette carte vers une patrouille"
          : "Vous ne pouvez déplacer que votre propre carte"
      }
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        {agent.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agent.avatarUrl}
            alt=""
            className="h-6 w-6 shrink-0 rounded-full border border-ink-600 object-cover"
          />
        ) : null}

        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-medium text-mist-100">
            {agent.isLead ? (
              <Crown className="mr-1 inline h-3 w-3 text-gold-500" />
            ) : null}
            {agent.name}
          </p>
          <p className="truncate font-mono text-[0.6rem] text-mist-500">
            #{agent.badgeNumber} · {agent.rankName}
          </p>
        </div>

        {canLead && !agent.isLead ? (
          <form action={setPatrolLead}>
            <input type="hidden" name="userId" value={agent.id} />
            <button
              type="submit"
              title="Désigner chef de bord"
              className="rounded p-0.5 text-mist-500 transition-colors hover:text-gold-500"
            >
              <Crown className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : null}

        {movable ? (
          <form action={moveAgent}>
            <input type="hidden" name="userId" value={agent.id} />
            <input type="hidden" name="patrolId" value="" />
            <button
              type="submit"
              title="Retirer de la patrouille"
              className="rounded p-0.5 text-mist-500 transition-colors hover:text-alert-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colonne (pool ou patrouille)
// ---------------------------------------------------------------------------

function Column({
  title,
  subtitle,
  count,
  patrolId,
  accent,
  header,
  footer,
  children,
  onDrop,
  isDragging,
  scroll = false,
  fill = false,
  grip,
  reordering = false,
  dragged = false,
  onReorderOver,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  count: number;
  patrolId: number | null;
  accent?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  onDrop: (patrolId: number | null) => void;
  isDragging: boolean;
  /** Colonne longue (le pool) : liste défilante au lieu d'étirer la hauteur. */
  scroll?: boolean;
  /** Remplit sa cellule (grille) au lieu d'une largeur fixe. */
  fill?: boolean;
  /** Poignée de glisser-déposer (réordonnancement des patrouilles). */
  grip?: React.ReactNode;
  /** Un réordonnancement de patrouille est en cours. */
  reordering?: boolean;
  /** Cette colonne est la patrouille en cours de déplacement. */
  dragged?: boolean;
  /** Survol pendant un réordonnancement : recalcule l'ordre. */
  onReorderOver?: () => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        // Réordonnancement d'une patrouille : aperçu en direct de la position.
        if (reordering) {
          e.preventDefault();
          onReorderOver?.();
          return;
        }
        // Sinon, dépôt d'une carte d'agent dans la colonne.
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        // Le réordonnancement est validé sur `onDragEnd` de la poignée.
        if (reordering) return;
        onDrop(patrolId);
      }}
      className={cn(
        // `self-start` : la colonne prend la hauteur de son contenu et ne
        // s'étire pas à la hauteur de la plus haute.
        "flex flex-col self-start rounded-xl border bg-ink-900/60 transition-colors",
        fill ? "w-full" : "w-60 shrink-0",
        dragged
          ? "border-badge-500/60 opacity-50 ring-2 ring-badge-500/40"
          : over
            ? "border-badge-400 bg-badge-600/10"
            : isDragging
              ? "border-badge-500/30 border-dashed"
              : "border-ink-700",
        accent,
      )}
    >
      <div className="border-b border-ink-700 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {grip}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-mist-100">
                {title}
              </p>
              {subtitle ? (
                <p className="truncate text-xs text-mist-500">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <Badge tone="neutral">{count}</Badge>
        </div>
        {header}
      </div>

      <div
        className={cn(
          "space-y-1.5 p-2",
          // Minimum de hauteur uniquement pour une patrouille vide, afin de
          // conserver une zone de dépôt visible.
          count === 0 && patrolId !== null && "min-h-20",
          scroll && "max-h-[36rem] overflow-y-auto",
        )}
      >
        {children}
        {count === 0 ? (
          <p className="py-4 text-center text-xs text-mist-500">
            Glissez une carte ici
          </p>
        ) : null}
      </div>

      {footer}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tableau de dispatch
// ---------------------------------------------------------------------------

export function DispatchBoard({
  pool,
  patrols,
  currentUserId,
  canManage,
}: {
  pool: AgentCard[];
  patrols: PatrolCard[];
  currentUserId: number;
  canManage: boolean;
}) {
  const [dragged, setDragged] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Réordonnancement des patrouilles (glisser-déposer), réservé au dispatch.
  const [ordered, setOrdered] = useState(patrols);
  const [dragPatrolId, setDragPatrolId] = useState<number | null>(null);
  useEffect(() => setOrdered(patrols), [patrols]);

  const onReorderOver = (overId: number) => {
    if (dragPatrolId === null || dragPatrolId === overId) return;
    setOrdered((prev) => {
      const from = prev.findIndex((p) => p.id === dragPatrolId);
      const to = prev.findIndex((p) => p.id === overId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const onReorderEnd = () => {
    if (dragPatrolId !== null) {
      startTransition(() => void reorderPatrols(ordered.map((p) => p.id)));
    }
    setDragPatrolId(null);
  };

  // Seuls le Watch Commander, l'Assistant Watch Commander et le Command Staff
  // déplacent les cartes ; les autres n'en déplacent aucune.
  const movable = () => canManage;

  const handleDrop = (patrolId: number | null) => {
    const agentId = dragged;
    setDragged(null);
    if (agentId === null) return;

    if (!movable()) {
      setError(
        "Seuls le Watch Commander, l'Assistant Watch Commander et le Command Staff peuvent déplacer les cartes.",
      );
      return;
    }

    setError(null);
    const data = new FormData();
    data.set("userId", String(agentId));
    data.set("patrolId", patrolId === null ? "" : String(patrolId));

    startTransition(async () => {
      try {
        await moveAgent(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Déplacement impossible.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-alert-500/40 bg-alert-600/15 px-4 py-3 text-sm text-alert-500"
        >
          {error}
        </p>
      ) : null}

      <div
        className="flex flex-col gap-4 lg:flex-row lg:items-start"
        onDragEnd={() => setDragged(null)}
      >
        {/* --- Pool des non assignés ------------------------------------- */}
        <Column
          title="Non assigné"
          subtitle="Agents sans dispatch"
          count={pool.length}
          patrolId={null}
          onDrop={handleDrop}
          isDragging={dragged !== null}
          reordering={dragPatrolId !== null}
          scroll
        >
          {pool.map((a) => (
            <Card
              key={a.id}
              agent={a}
              movable={movable()}
              canLead={false}
              onDragStart={setDragged}
              pending={pending && dragged === a.id}
            />
          ))}
        </Column>

        {/* --- Patrouilles : 5 par ligne -------------------------------- */}
        <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {ordered.map((p) => {
          const inThisPatrol = p.members.some((m) => m.id === currentUserId);
          const editable = canManage || inThisPatrol;

          return (
            <Column
              key={p.id}
              title={
                <span className="flex items-center gap-2">
                  <Radio className="h-3.5 w-3.5 text-badge-400" />
                  {p.callSign}
                  {p.number ? `-${p.number}` : ""}
                </span>
              }
              count={p.members.length}
              patrolId={p.id}
              accent={inThisPatrol ? "ring-1 ring-badge-500/40" : undefined}
              onDrop={handleDrop}
              isDragging={dragged !== null}
              fill
              grip={
                canManage ? (
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", "patrol");
                      setDragPatrolId(p.id);
                    }}
                    onDragEnd={onReorderEnd}
                    title="Glisser pour réordonner"
                    className="shrink-0 cursor-grab text-mist-600 transition-colors hover:text-mist-300 active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                ) : undefined
              }
              reordering={dragPatrolId !== null}
              dragged={dragPatrolId === p.id}
              onReorderOver={() => onReorderOver(p.id)}
              header={
                <PatrolControls
                  patrolId={p.id}
                  status={p.status}
                  sector={p.sector}
                  editable={editable}
                />
              }
              footer={
                canManage || p.createdById === currentUserId ? (
                  <form action={deletePatrol} className="border-t border-ink-700 px-3 py-2">
                    <input type="hidden" name="patrolId" value={p.id} />
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-1.5 rounded py-1 text-[0.68rem] text-mist-500 transition-colors hover:text-alert-500"
                    >
                      <Trash2 className="h-3 w-3" />
                      Dissoudre la patrouille
                    </button>
                  </form>
                ) : null
              }
            >
              {p.members.map((a) => (
                <Card
                  key={a.id}
                  agent={a}
                  movable={movable()}
                  canLead={canManage}
                  onDragStart={setDragged}
                  pending={pending && dragged === a.id}
                />
              ))}
            </Column>
          );
        })}
        </div>
      </div>
    </div>
  );
}
