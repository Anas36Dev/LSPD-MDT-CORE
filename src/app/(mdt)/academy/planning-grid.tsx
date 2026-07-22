"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, MapPin, X } from "lucide-react";

import { deleteScheduleSlot, moveScheduleSlot } from "./actions";

// Fenêtre 15h00 → 00h00.
const WINDOW_START = 900;
const SPAN = 540;
const PX_PER_MIN = 0.8;
const PAD_TOP = 10;
const SNAP = 15; // pas d'accroche en minutes
const GRID_H = SPAN * PX_PER_MIN + PAD_TOP + 14;
const HOUR_MARKS = Array.from({ length: 10 }, (_, i) => (15 + i) % 24);

const extended = (m: number) => (m >= WINDOW_START ? m : m + 1440);
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

export type PlanningSlot = {
  id: number;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  title: string;
  location: string | null;
  details: string | null;
};

type Pos = { dayOfWeek: number; startMin: number; endMin: number };

export function PlanningGrid({
  days,
  todayIndex,
  slots,
  canEdit,
}: {
  days: { name: string; date: string }[];
  todayIndex: number;
  slots: PlanningSlot[];
  canEdit: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  // Heure courante (côté client) pour la barre « maintenant ». Null avant le
  // montage pour éviter tout écart d'hydratation ; rafraîchie chaque minute.
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  const nowExt = nowMin === null ? null : extended(nowMin);
  const nowTop =
    nowExt !== null && nowExt >= WINDOW_START && nowExt <= WINDOW_START + SPAN
      ? PAD_TOP + (nowExt - WINDOW_START) * PX_PER_MIN
      : null;
  const [drag, setDrag] = useState<{
    id: number;
    dur: number;
    ox: number;
    oy: number;
    moved: boolean;
    pos: Pos;
  } | null>(null);
  const [pending, setPending] = useState<Record<number, Pos>>({});
  const [openId, setOpenId] = useState<number | null>(null);

  const posOf = (s: PlanningSlot): Pos => {
    if (drag && drag.id === s.id && drag.moved) return drag.pos;
    if (pending[s.id]) return pending[s.id];
    return { dayOfWeek: s.dayOfWeek, startMin: s.startMin, endMin: s.endMin };
  };

  function computePos(clientX: number, clientY: number, dur: number): Pos {
    const rect = bodyRef.current!.getBoundingClientRect();
    const colW = rect.width / 7;
    const day = Math.max(0, Math.min(6, Math.floor((clientX - rect.left) / colW)));
    let startExt = (clientY - rect.top - PAD_TOP) / PX_PER_MIN + WINDOW_START;
    startExt = Math.round(startExt / SNAP) * SNAP;
    startExt = Math.max(
      WINDOW_START,
      Math.min(WINDOW_START + SPAN - dur, startExt),
    );
    return {
      dayOfWeek: day,
      startMin: startExt % 1440,
      endMin: (startExt + dur) % 1440,
    };
  }

  function onDown(e: React.PointerEvent, s: PlanningSlot) {
    if (!canEdit) {
      setOpenId(s.id);
      return;
    }
    e.preventDefault();
    bodyRef.current?.setPointerCapture(e.pointerId);
    setDrag({
      id: s.id,
      dur: extended(s.endMin) - extended(s.startMin),
      ox: e.clientX,
      oy: e.clientY,
      moved: false,
      pos: { dayOfWeek: s.dayOfWeek, startMin: s.startMin, endMin: s.endMin },
    });
  }

  function onMove(e: React.PointerEvent) {
    if (!drag) return;
    const dist = Math.hypot(e.clientX - drag.ox, e.clientY - drag.oy);
    if (!drag.moved && dist < 5) return;
    setDrag({
      ...drag,
      moved: true,
      pos: computePos(e.clientX, e.clientY, drag.dur),
    });
  }

  async function onUp() {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) {
      setOpenId(d.id);
      return;
    }
    setPending((p) => ({ ...p, [d.id]: d.pos }));
    await moveScheduleSlot(d.id, d.pos.dayOfWeek, d.pos.startMin, d.pos.endMin);
    setPending((p) => {
      const n = { ...p };
      delete n[d.id];
      return n;
    });
  }

  const openSlot = slots.find((s) => s.id === openId) ?? null;

  return (
    <div className="overflow-x-auto overflow-y-hidden">
      <div className="flex min-w-[920px]">
        {/* Colonne des heures */}
        <div className="w-14 shrink-0 border-r border-ink-700">
          <div className="h-12 border-b border-ink-700 bg-ink-850/40" />
          <div className="relative" style={{ height: GRID_H }}>
            {HOUR_MARKS.map((h, i) => (
              <div
                key={i}
                className="absolute right-2 -translate-y-1/2 text-xs font-medium text-mist-400"
                style={{ top: PAD_TOP + i * 60 * PX_PER_MIN }}
              >
                {pad(h)}h
              </div>
            ))}
          </div>
        </div>

        {/* Zone des jours */}
        <div className="min-w-0 flex-1">
          {/* En-têtes de jours (nom + date) — le jour courant est surligné */}
          <div className="flex">
            {days.map((day, i) => {
              const today = i === todayIndex;
              return (
                <div
                  key={day.name}
                  className={`flex h-12 flex-1 flex-col items-center justify-center border-r border-b border-ink-700 last:border-r-0 ${
                    today ? "bg-badge-600/15" : "bg-ink-850/40"
                  }`}
                >
                  <span
                    className={`text-sm font-semibold tracking-wide ${
                      today ? "text-badge-200" : "text-mist-200"
                    }`}
                  >
                    {day.name}
                  </span>
                  <span
                    className={`text-[0.7rem] ${
                      today ? "text-badge-300" : "text-mist-500"
                    }`}
                  >
                    {day.date}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Corps : colonnes + créneaux positionnés */}
          <div
            ref={bodyRef}
            onPointerMove={onMove}
            onPointerUp={onUp}
            className="relative flex touch-none select-none"
            style={{ height: GRID_H }}
          >
            {/* Séparateurs de colonnes — la colonne du jour courant est teintée */}
            {days.map((day, i) => (
              <div
                key={day.name}
                className={`flex-1 border-r border-ink-700 last:border-r-0 ${
                  i === todayIndex ? "bg-badge-600/[0.06]" : ""
                }`}
              />
            ))}

            {/* Lignes horaires (pleine largeur) */}
            {HOUR_MARKS.map((_, i) => (
              <div
                key={i}
                className="pointer-events-none absolute inset-x-0 border-t border-ink-800/70"
                style={{ top: PAD_TOP + i * 60 * PX_PER_MIN }}
              />
            ))}

            {/* Barre « maintenant » : défile avec l'heure sur la colonne du jour */}
            {nowTop !== null ? (
              <div
                className="pointer-events-none absolute z-10"
                style={{
                  top: nowTop,
                  left: `${(todayIndex / 7) * 100}%`,
                  width: `${100 / 7}%`,
                }}
              >
                <div className="relative border-t-2 border-badge-400">
                  <span className="absolute -top-[4px] left-0 h-2 w-2 rounded-full bg-badge-400" />
                </div>
              </div>
            ) : null}

            {/* Créneaux */}
            {slots.map((s) => {
              const p = posOf(s);
              const start = extended(p.startMin);
              const end = extended(p.endMin);
              const top = PAD_TOP + (start - WINDOW_START) * PX_PER_MIN;
              const height = Math.max(18, (end - start) * PX_PER_MIN - 2);
              const dragging = drag?.id === s.id && drag.moved;
              return (
                <div
                  key={s.id}
                  onPointerDown={(e) => onDown(e, s)}
                  style={{
                    top,
                    height,
                    left: `calc(${(p.dayOfWeek / 7) * 100}% + 4px)`,
                    width: `calc(${100 / 7}% - 8px)`,
                  }}
                  className={`absolute overflow-hidden rounded-md border border-badge-500/40 bg-badge-600/25 px-1.5 py-1 ${
                    canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                  } ${dragging ? "z-20 opacity-90 shadow-lg" : "hover:bg-badge-600/35"}`}
                >
                  <p className="truncate text-[0.72rem] font-medium text-badge-200">
                    {s.title}
                  </p>
                  <p className="text-[0.66rem] text-mist-400">
                    {fmt(p.startMin)}–{fmt(p.endMin)}
                  </p>
                  {s.location ? (
                    <p className="truncate text-[0.66rem] text-mist-500">
                      {s.location}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fiche de détails */}
      {openSlot ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-ink-600 bg-ink-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink-700 px-5 py-4">
              <div>
                <p className="text-[0.65rem] tracking-wide text-mist-500 uppercase">
                  {days[openSlot.dayOfWeek]?.name} {days[openSlot.dayOfWeek]?.date}
                </p>
                <h2 className="mt-0.5 text-base font-semibold text-mist-100">
                  {openSlot.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="rounded p-1 text-mist-500 transition-colors hover:text-mist-100"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <div className="flex items-center gap-2 text-sm text-mist-300">
                <Clock className="h-4 w-4 text-mist-500" />
                {fmt(openSlot.startMin)}–{fmt(openSlot.endMin)}
              </div>
              {openSlot.location ? (
                <div className="flex items-center gap-2 text-sm text-mist-300">
                  <MapPin className="h-4 w-4 text-mist-500" />
                  {openSlot.location}
                </div>
              ) : null}
              {openSlot.details ? (
                <p className="text-sm leading-relaxed whitespace-pre-line text-mist-300">
                  {openSlot.details}
                </p>
              ) : (
                <p className="text-sm text-mist-500">
                  Aucun détail supplémentaire.
                </p>
              )}
            </div>

            {canEdit ? (
              <div className="flex justify-end border-t border-ink-700 px-5 py-3">
                <form action={deleteScheduleSlot}>
                  <input type="hidden" name="slotId" value={openSlot.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-md border border-alert-500/50 px-3 py-1.5 text-xs text-alert-500 transition-colors hover:bg-alert-600/15"
                  >
                    <X className="h-3.5 w-3.5" />
                    Supprimer le créneau
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
