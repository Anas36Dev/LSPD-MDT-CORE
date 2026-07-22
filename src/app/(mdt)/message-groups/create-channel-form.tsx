"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import { createChannel, updateChannel, type ChannelState } from "./actions";

export type RankOption = { code: string; name: string; category: string };
export type MemberOption = { id: number; label: string };
export type NamedOption = { code: string; name: string };

export type ChannelInitial = {
  id: number;
  name: string;
  rankCodes: string[];
  userIds: number[];
  divisionCodes: string[];
  certCodes: string[];
};

export function ChannelCreator({
  mode = "create",
  initial,
  ranks,
  divisions,
  certifications,
  members,
}: {
  mode?: "create" | "edit";
  initial?: ChannelInitial;
  ranks: RankOption[];
  divisions: NamedOption[];
  certifications: NamedOption[];
  members: MemberOption[];
}) {
  const isEdit = mode === "edit";
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ChannelState, FormData>(
    isEdit ? updateChannel : createChannel,
    undefined,
  );

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-xs text-mist-300 transition-colors hover:border-badge-500/50 hover:text-badge-300"
        >
          <Pencil className="h-4 w-4" />
          Gérer l&apos;accès
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-badge-500/60 bg-badge-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-badge-500"
        >
          <Plus className="h-4 w-4" />
          Créer un canal
        </button>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-ink-700 bg-ink-900 text-left shadow-2xl shadow-black/50"
          >
            <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-mist-100">
                  {isEdit ? "Gérer l'accès au canal" : "Créer un canal"}
                </h2>
                <p className="mt-0.5 text-xs text-mist-500">
                  Accès par grades, divisions, habilitations et/ou membres
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-mist-500 transition-colors hover:text-mist-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={action} className="space-y-4 px-5 py-4">
              {isEdit && initial ? (
                <input type="hidden" name="channelId" value={initial.id} />
              ) : null}

              <Field label="Nom du canal">
                <Input
                  name="name"
                  required
                  defaultValue={initial?.name}
                  placeholder="Cellule opérationnelle…"
                />
              </Field>

              <div>
                <span className="label-tag">Grades ayant accès</span>
                <div className="mt-1.5 grid max-h-44 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-ink-700 bg-ink-850/50 p-2 sm:grid-cols-3">
                  {ranks.map((r) => {
                    const locked = r.category === "CHIEF_OFFICE";
                    return (
                      <label
                        key={r.code}
                        className={`flex items-center gap-2 rounded px-1.5 py-1 text-xs ${
                          locked
                            ? "cursor-not-allowed text-mist-500"
                            : "cursor-pointer text-mist-200 hover:bg-ink-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name={locked ? undefined : "rankCode"}
                          value={r.code}
                          defaultChecked={
                            locked || initial?.rankCodes.includes(r.code)
                          }
                          disabled={locked}
                          className="h-3.5 w-3.5 accent-[var(--color-badge-500)]"
                        />
                        {/* Case Chief Office verrouillée : soumise via un champ
                            caché puisqu'un input désactivé n'est pas transmis. */}
                        {locked ? (
                          <input type="hidden" name="rankCode" value={r.code} />
                        ) : null}
                        {r.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              {divisions.length > 0 ? (
                <div>
                  <span className="label-tag">Divisions ayant accès</span>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg border border-ink-700 bg-ink-850/50 p-2 sm:grid-cols-3">
                    {divisions.map((d) => (
                      <label
                        key={d.code}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-mist-200 hover:bg-ink-800"
                      >
                        <input
                          type="checkbox"
                          name="divisionCode"
                          value={d.code}
                          defaultChecked={initial?.divisionCodes.includes(d.code)}
                          className="h-3.5 w-3.5 shrink-0 accent-[var(--color-badge-500)]"
                        />
                        <span className="truncate">{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {certifications.length > 0 ? (
                <div>
                  <span className="label-tag">Habilitations ayant accès</span>
                  <div className="mt-1.5 grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-ink-700 bg-ink-850/50 p-2 sm:grid-cols-3">
                    {certifications.map((cert) => (
                      <label
                        key={cert.code}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-mist-200 hover:bg-ink-800"
                      >
                        <input
                          type="checkbox"
                          name="certCode"
                          value={cert.code}
                          defaultChecked={initial?.certCodes.includes(cert.code)}
                          className="h-3.5 w-3.5 shrink-0 accent-[var(--color-badge-500)]"
                        />
                        <span className="truncate">{cert.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <span className="label-tag">Membres individuels</span>
                <div className="mt-1.5 grid max-h-44 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-ink-700 bg-ink-850/50 p-2 sm:grid-cols-2">
                  {members.map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-mist-200 hover:bg-ink-800"
                    >
                      <input
                        type="checkbox"
                        name="userId"
                        value={m.id}
                        defaultChecked={initial?.userIds.includes(m.id)}
                        className="h-3.5 w-3.5 shrink-0 accent-[var(--color-badge-500)]"
                      />
                      <span className="truncate">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <ActionFeedback error={state?.error} success={state?.success} />

              <div className="flex justify-end gap-2 border-t border-ink-700 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={pending}>
                  {isEdit ? (
                    <Pencil className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {pending
                    ? "Enregistrement…"
                    : isEdit
                      ? "Enregistrer"
                      : "Créer le canal"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
