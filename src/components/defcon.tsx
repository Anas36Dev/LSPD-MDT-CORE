import { ShieldAlert } from "lucide-react";

/**
 * Niveaux DEFCON du département.
 *
 * Les couleurs sont imposées par le règlement : 5 vert, 4 jaune, 3 orange,
 * 2 rouge, 1 noir. Elles sont écrites en dur plutôt que dérivées du thème,
 * car leur valeur est réglementaire et non décorative.
 */
export const DEFCON_LEVELS: Record<
  number,
  {
    label: string;
    color: string;
    text: string;
    border: string;
    bg: string;
    glow: string;
  }
> = {
  5: {
    label: "Préparation normale",
    color: "#2f9e63",
    text: "text-[#4ec98a]",
    border: "border-[#2f9e63]/50",
    bg: "bg-[#2f9e63]/10",
    glow: "shadow-[0_0_20px_rgba(47,158,99,0.25)]",
  },
  4: {
    label: "Renseignements accrus, sécurité renforcée",
    color: "#d9c026",
    text: "text-[#e3cf4a]",
    border: "border-[#d9c026]/50",
    bg: "bg-[#d9c026]/10",
    glow: "shadow-[0_0_20px_rgba(217,192,38,0.25)]",
  },
  3: {
    label: "Forces prêtes à être mobilisées en 15 minutes",
    color: "#e07b1f",
    text: "text-[#f0964a]",
    border: "border-[#e07b1f]/50",
    bg: "bg-[#e07b1f]/10",
    glow: "shadow-[0_0_20px_rgba(224,123,31,0.3)]",
  },
  2: {
    label: "Préparation renforcée, l'Armée est prête",
    color: "#d23a30",
    text: "text-[#e8574c]",
    border: "border-[#d23a30]/60",
    bg: "bg-[#d23a30]/12",
    glow: "shadow-[0_0_24px_rgba(210,58,48,0.35)]",
  },
  1: {
    label: "Préparation maximale — état de guerre",
    color: "#0a0a0a",
    text: "text-mist-100",
    border: "border-mist-500/60",
    bg: "bg-black/60",
    glow: "shadow-[0_0_24px_rgba(0,0,0,0.8)]",
  },
};

export function DefconBanner({
  level,
  reason,
  setBy,
  compact = false,
}: {
  level: number;
  reason?: string | null;
  setBy?: string | null;
  compact?: boolean;
}) {
  const d = DEFCON_LEVELS[level] ?? DEFCON_LEVELS[5];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${d.border} ${d.bg} ${d.text}`}
      >
        DEFCON {level}
      </span>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-5 rounded-xl border px-6 py-4 ${d.border} ${d.bg} ${d.glow}`}
    >
      {/* Le chiffre doit se lire d'un coup d'œil depuis l'autre bout de la pièce. */}
      <div
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 ${d.border}`}
        style={{ backgroundColor: `${d.color}22` }}
      >
        <span className={`text-3xl font-bold ${d.text}`}>{level}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldAlert className={`h-4 w-4 ${d.text}`} />
          <p className={`text-sm font-semibold tracking-wide ${d.text}`}>
            DEFCON {level}
          </p>
          {level <= 3 ? (
            <span className="rounded border border-alert-500/50 bg-alert-600/20 px-1.5 py-0.5 text-[0.62rem] font-semibold text-alert-500 uppercase">
              Port d&apos;arme assoupli
            </span>
          ) : null}
        </div>

        <p className="mt-0.5 text-sm text-mist-300">{d.label}</p>

        {reason ? (
          <p className="mt-1.5 text-xs leading-relaxed text-mist-300">
            {reason}
          </p>
        ) : null}

        {setBy ? (
          <p className="mt-1 text-[0.68rem] text-mist-500">Fixé par {setBy}</p>
        ) : null}
      </div>
    </div>
  );
}
