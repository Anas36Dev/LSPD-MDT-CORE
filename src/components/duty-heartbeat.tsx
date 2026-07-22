"use client";

import { useEffect } from "react";

import { pingDuty } from "@/app/(mdt)/duty-actions";

/**
 * Tant que l'agent est en service et que la page reste ouverte, envoie un ping
 * régulier pour maintenir sa vacation active. Si la page se ferme, les pings
 * s'arrêtent : le temps de service se fige au dernier ping.
 */
export function DutyHeartbeat({ onDuty }: { onDuty: boolean }) {
  useEffect(() => {
    if (!onDuty) return;
    void pingDuty();
    const t = setInterval(() => void pingDuty(), 60_000);
    return () => clearInterval(t);
  }, [onDuty]);

  return null;
}
