import { Panel } from "@/components/ui";

/**
 * Écran d'attente d'un module dont l'accès est déjà sécurisé mais dont les
 * fonctionnalités arrivent dans une phase ultérieure. La page appelle bien
 * `requireModule`, donc le cloisonnement est actif dès maintenant.
 */
export function ModulePlaceholder({
  title,
  phase,
  description,
  features,
}: {
  title: string;
  phase: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">{title}</h1>
        <p className="mt-1 text-sm text-mist-500">{description}</p>
      </div>

      <Panel className="px-6 py-6">
        <p className="label-tag">Livraison prévue</p>
        <p className="mt-1 text-sm font-medium text-gold-400">{phase}</p>

        <p className="label-tag mt-6">Fonctionnalités prévues</p>
        <ul className="mt-2 space-y-1.5">
          {features.map((f) => (
            <li key={f} className="flex gap-2.5 text-sm text-mist-300">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-badge-400" />
              {f}
            </li>
          ))}
        </ul>

        <p className="mt-6 border-t border-ink-700 pt-4 text-xs leading-relaxed text-mist-500">
          L&apos;accès à ce module est déjà protégé par le moteur de
          permissions : seuls les agents autorisés voient cette page dans leur
          menu.
        </p>
      </Panel>
    </div>
  );
}
