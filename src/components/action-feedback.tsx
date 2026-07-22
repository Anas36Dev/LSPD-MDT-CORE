"use client";

import { useEffect, useState } from "react";

/**
 * Message de validation / d'échec d'une action, affiché puis effacé
 * automatiquement : 3 s pour un succès, 10 s pour une erreur.
 */
export function ActionFeedback({
  error,
  success,
  className,
}: {
  error?: string | null;
  success?: string | null;
  className?: string;
}) {
  const [shown, setShown] = useState<{
    error?: string | null;
    success?: string | null;
  }>({ error, success });

  useEffect(() => {
    setShown({ error, success });
    // Erreur : 10 s (le temps de la lire) ; succès : 3 s (confirmation brève).
    const delay = error ? 10_000 : success ? 3_000 : 0;
    if (delay > 0) {
      const t = setTimeout(() => setShown({}), delay);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const base = `rounded-lg border px-3.5 py-2.5 text-xs ${className ?? ""}`;

  if (shown.error) {
    return (
      <p
        role="alert"
        className={`${base} border-alert-500/40 bg-alert-600/15 text-alert-500`}
      >
        {shown.error}
      </p>
    );
  }
  if (shown.success) {
    return (
      <p className={`${base} border-ok-500/40 bg-ok-500/15 text-ok-500`}>
        {shown.success}
      </p>
    );
  }
  return null;
}
