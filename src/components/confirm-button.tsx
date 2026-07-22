"use client";

import { useState, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui";

/**
 * Bouton d'action assorti d'une confirmation aux couleurs du MDT (remplace le
 * `window.confirm` natif). Le bouton déclencheur est libre ; à la confirmation,
 * un formulaire poste la Server Action fournie avec ses champs cachés.
 */
export function ConfirmButton({
  action,
  fields = {},
  title = "Confirmer l'action",
  message,
  confirmLabel = "Confirmer",
  danger = true,
  trigger,
  triggerClassName,
  triggerTitle,
  disabled = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields?: Record<string, string | number>;
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  trigger: ReactNode;
  triggerClassName?: string;
  triggerTitle?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        title={triggerTitle}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 text-left shadow-2xl shadow-black/50"
          >
            <div className="flex items-start gap-3 px-5 py-5">
              <span
                className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  danger
                    ? "bg-alert-600/15 text-alert-500"
                    : "bg-badge-600/15 text-badge-300"
                }`}
              >
                <TriangleAlert className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-mist-100">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-mist-300">
                  {message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-ink-700 px-5 py-3.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              {/* Pas de fermeture au clic : cela démonterait le formulaire avant
                  l'envoi de la Server Action. La modale disparaît via la
                  navigation (redirect) ou la revalidation de la liste. */}
              <form action={action}>
                {Object.entries(fields).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
                <Button type="submit" variant={danger ? "danger" : "primary"}>
                  {confirmLabel}
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
