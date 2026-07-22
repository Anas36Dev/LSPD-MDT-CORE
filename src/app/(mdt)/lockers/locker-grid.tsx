"use client";

import { useEffect, useState, useTransition } from "react";
import {
  GripVertical,
  Lock,
  LockOpen,
  PackageOpen,
  Trash2,
  X,
} from "lucide-react";

import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import {
  deleteLocker,
  emptyLocker,
  lockLocker,
  removeItem,
  reorderLockers,
} from "./actions";
import { DepositForm, UnlockForm } from "./forms";

export type LockerData = {
  id: number;
  name: string;
  isDefault: boolean;
  hasCode: boolean;
  locked: boolean;
  itemCount: number;
  items: {
    id: number;
    label: string;
    quantity: number | null;
    by: string;
    createdAt: string;
  }[];
};

export function LockerGrid({
  lockers,
  canManage,
  canWithdraw,
  canEmpty,
  canReorder,
}: {
  lockers: LockerData[];
  canManage: boolean;
  canWithdraw: boolean;
  canEmpty: boolean;
  canReorder: boolean;
}) {
  const [order, setOrder] = useState(lockers);
  const [dragId, setDragId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => setOrder(lockers), [lockers]);

  const onDragOver = (overId: number) => {
    if (dragId === null || dragId === overId) return;
    setOrder((prev) => {
      const from = prev.findIndex((l) => l.id === dragId);
      const to = prev.findIndex((l) => l.id === overId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const onDragEnd = () => {
    if (dragId !== null) {
      startTransition(() => void reorderLockers(order.map((l) => l.id)));
    }
    setDragId(null);
  };

  const openLocker = order.find((l) => l.id === openId) ?? null;

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4">
        {order.map((locker) => (
          <div
            key={locker.id}
            draggable={canReorder}
            onDragStart={() => setDragId(locker.id)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => {
              if (canReorder && dragId !== null) {
                e.preventDefault();
                onDragOver(locker.id);
              }
            }}
            onDrop={(e) => e.preventDefault()}
            onClick={() => setOpenId(locker.id)}
            className={`relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border bg-ink-900/80 p-4 text-center transition-colors hover:border-badge-500/50 hover:bg-ink-800/60 ${
              dragId === locker.id
                ? "border-badge-500/60 opacity-50 ring-2 ring-badge-500/40"
                : "border-ink-700"
            }`}
          >
            {canReorder ? (
              <GripVertical
                className="absolute top-2 left-2 h-4 w-4 cursor-grab text-mist-600 active:cursor-grabbing"
                onClick={(e) => e.stopPropagation()}
              />
            ) : null}
            {locker.locked ? (
              <span className="absolute top-2 right-2">
                <Badge tone="amber">
                  <Lock className="h-3 w-3" />
                </Badge>
              </span>
            ) : (
              <span className="absolute top-2 right-2">
                <Badge tone="neutral">{locker.itemCount}</Badge>
              </span>
            )}

            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink-600 bg-ink-850 text-badge-300">
              {locker.hasCode ? (
                <Lock className="h-5 w-5" />
              ) : (
                <LockOpen className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-mist-100">
                {locker.name}
              </p>
              <p className="mt-0.5 text-xs text-mist-500">
                {locker.locked ? "Verrouillé" : `${locker.itemCount} objet(s)`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {openLocker ? (
        <LockerModal
          locker={openLocker}
          canManage={canManage}
          canWithdraw={canWithdraw}
          canEmpty={canEmpty}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </>
  );
}

function LockerModal({
  locker,
  canManage,
  canWithdraw,
  canEmpty,
  onClose,
}: {
  locker: LockerData;
  canManage: boolean;
  canWithdraw: boolean;
  canEmpty: boolean;
  onClose: () => void;
}) {
  // Récapitulatif : total des dépôts, total des quantités et cumul par objet.
  const totalQty = locker.items.reduce((s, i) => s + (i.quantity ?? 1), 0);
  const byLabel = new Map<string, number>();
  for (const it of locker.items) {
    byLabel.set(it.label, (byLabel.get(it.label) ?? 0) + (it.quantity ?? 1));
  }
  const breakdown = [...byLabel.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-2xl border border-ink-700 bg-ink-900 text-left shadow-2xl shadow-black/50"
      >
        {/* --- En-tête --------------------------------------------------- */}
        <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-5 py-4">
          <div className="flex items-center gap-2">
            {locker.hasCode ? (
              <Lock className="h-4 w-4 text-badge-300" />
            ) : (
              <LockOpen className="h-4 w-4 text-badge-300" />
            )}
            <h2 className="text-base font-semibold text-mist-100">
              {locker.name}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {locker.hasCode && !locker.locked ? (
              <form action={lockLocker}>
                <input type="hidden" name="lockerId" value={locker.id} />
                <button
                  type="submit"
                  title="Reverrouiller"
                  className="inline-flex items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-[0.68rem] text-mist-400 transition-colors hover:border-badge-500/50 hover:text-badge-300"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Verrouiller
                </button>
              </form>
            ) : null}
            {canEmpty && !locker.locked && locker.itemCount > 0 ? (
              <ConfirmButton
                action={emptyLocker}
                fields={{ id: locker.id }}
                title="Vider le casier"
                message={`Signaler que « ${locker.name} » a été vidé ? Toutes les saisies seront retirées.`}
                confirmLabel="Vider"
                triggerTitle="Vider le casier"
                triggerClassName="inline-flex items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-[0.68rem] text-mist-400 transition-colors hover:border-warn-500/50 hover:text-warn-500"
                trigger={
                  <>
                    <PackageOpen className="h-3.5 w-3.5" />
                    Vider
                  </>
                }
              />
            ) : null}
            {canManage && !locker.isDefault ? (
              <ConfirmButton
                action={deleteLocker}
                fields={{ id: locker.id }}
                title="Supprimer le casier"
                message={`Supprimer définitivement le casier « ${locker.name} » et son contenu ?`}
                confirmLabel="Supprimer"
                triggerTitle="Supprimer le casier"
                triggerClassName="rounded-md p-1.5 text-mist-500 transition-colors hover:text-alert-500"
                trigger={<Trash2 className="h-4 w-4" />}
              />
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-mist-500 transition-colors hover:text-mist-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {locker.locked ? (
          <UnlockForm lockerId={locker.id} />
        ) : (
          <div className="grid gap-px bg-ink-700 md:grid-cols-[1fr_18rem]">
            {/* --- Contenu ------------------------------------------------ */}
            <div className="flex max-h-[70vh] flex-col bg-ink-900">
              <div className="flex-1 overflow-y-auto">
                {locker.items.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-mist-500">
                    Casier vide.
                  </p>
                ) : (
                  <ul className="divide-y divide-ink-800">
                    {locker.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-2 px-5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-mist-100">
                            {item.quantity ? (
                              <span className="font-mono text-badge-300">
                                {item.quantity}×{" "}
                              </span>
                            ) : null}
                            {item.label}
                          </p>
                          <p className="text-[0.62rem] text-mist-500">
                            {item.by} · {formatDateTime(item.createdAt)}
                          </p>
                        </div>
                        {canWithdraw ? (
                          <form action={removeItem}>
                            <input type="hidden" name="itemId" value={item.id} />
                            <button
                              type="submit"
                              title="Retirer l'objet"
                              className="shrink-0 rounded-md p-1 text-mist-500 transition-colors hover:text-alert-500"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <DepositForm lockerId={locker.id} />
            </div>

            {/* --- Récapitulatif à droite -------------------------------- */}
            <div className="bg-ink-900 px-5 py-4">
              <p className="label-tag mb-3">Récapitulatif</p>
              <div className="space-y-1.5 border-b border-ink-700 pb-3 text-sm">
                <div className="flex justify-between text-mist-300">
                  <span>Dépôts</span>
                  <span className="text-mist-100">{locker.items.length}</span>
                </div>
                <div className="flex justify-between text-mist-300">
                  <span>Quantité totale</span>
                  <span className="text-mist-100">{totalQty}</span>
                </div>
              </div>
              {breakdown.length === 0 ? (
                <p className="mt-3 text-xs text-mist-500">
                  Aucun objet déposé.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {breakdown.map(([label, qty]) => (
                    <li
                      key={label}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-mist-200">
                        {label}
                      </span>
                      <span className="shrink-0 font-mono text-badge-300">
                        ×{qty}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
