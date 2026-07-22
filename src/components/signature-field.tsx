"use client";

import { useState } from "react";
import { PenLine, X } from "lucide-react";

/**
 * Case de signature en bas d'un document. Un simple bouton « Signer » inscrit
 * automatiquement la signature officielle de l'agent (« Grade Matricule |
 * Prénom NOM ») dans la case. Un champ caché `signed` transmet l'acte au
 * serveur, qui réappose lui-même la signature authentifiée : elle ne peut donc
 * pas être falsifiée.
 */
export function SignatureField({
  signature,
  label = "Signature de l'agent rédigeant",
  hint,
}: {
  signature: string;
  label?: string;
  hint?: string;
}) {
  const [signed, setSigned] = useState(false);

  return (
    <div className="rounded-lg border border-ink-600 bg-ink-850/60 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="label-tag">{label}</span>
        {signed ? (
          <button
            type="button"
            onClick={() => setSigned(false)}
            className="inline-flex items-center gap-1 text-xs text-mist-500 transition-colors hover:text-alert-500"
          >
            <X className="h-3.5 w-3.5" />
            Retirer
          </button>
        ) : null}
      </div>

      {signed ? (
        <>
          <input type="hidden" name="signed" value="true" />
          <p className="mt-2 border-t border-dashed border-ink-600 pt-2 font-serif text-base italic text-mist-100">
            {signature}
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setSigned(true)}
          className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-badge-500/50 bg-badge-600/15 px-3.5 py-2 text-sm font-medium text-badge-300 transition-colors hover:bg-badge-600/25"
        >
          <PenLine className="h-4 w-4" />
          Signer le document
        </button>
      )}

      {hint ? <p className="mt-2 text-xs text-mist-500">{hint}</p> : null}
    </div>
  );
}
