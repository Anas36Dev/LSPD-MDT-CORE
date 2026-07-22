"use client";

import { useEffect, useState } from "react";
import { Power, PowerOff } from "lucide-react";

import { Button } from "@/components/ui";
import { endDuty, startDuty } from "../duty-actions";

function formatDuration(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function DutyPanel({
  onDuty,
  todaySeconds,
}: {
  onDuty: boolean;
  todaySeconds: number;
}) {
  const [secs, setSecs] = useState(todaySeconds);

  // Le compteur avance en direct tant que l'agent est en service.
  useEffect(() => {
    setSecs(todaySeconds);
    if (!onDuty) return;
    const t = setInterval(() => setSecs((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [onDuty, todaySeconds]);

  return (
    <div className="flex flex-col items-center gap-1">
      <form action={onDuty ? endDuty : startDuty}>
        <Button
          type="submit"
          variant={onDuty ? "danger" : "primary"}
          className="px-3.5 py-2 text-xs"
        >
          {onDuty ? (
            <>
              <PowerOff className="h-4 w-4" />
              Terminer le service
            </>
          ) : (
            <>
              <Power className="h-4 w-4" />
              Prendre son service
            </>
          )}
        </Button>
      </form>
      <p className="text-[0.68rem] text-mist-500">
        Aujourd&apos;hui :{" "}
        <span className="font-mono text-mist-300">{formatDuration(secs)}</span>
      </p>
    </div>
  );
}
