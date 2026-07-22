/**
 * Galons d'ancienneté : un « stripe » (barre diagonale dorée) par année de
 * service. Espacement uniforme, avec passage à la ligne au-delà de plusieurs
 * années.
 */
export function ServiceStripes({ years }: { years: number }) {
  const n = Math.max(0, years);
  if (n === 0) {
    return <span className="text-sm text-mist-500">Moins d&apos;un an</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex max-w-[220px] flex-wrap items-center gap-[4px]">
        {Array.from({ length: n }).map((_, i) => (
          <span
            key={i}
            className="h-4 w-[5px] -skew-x-[20deg] rounded-[1px] bg-gold-500/85 shadow-[0_0_4px_rgba(212,175,55,0.35)]"
          />
        ))}
      </div>
      <span className="text-xs text-mist-500">
        {n} an{n > 1 ? "s" : ""}
      </span>
    </div>
  );
}
