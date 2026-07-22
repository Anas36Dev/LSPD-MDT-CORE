/**
 * Règles opérationnelles associées à chaque niveau DEFCON.
 *
 * Valeurs de départ, à ajuster par le Command Staff selon le règlement du
 * serveur. Chaque niveau précise l'armement autorisé, les règles de contrôle
 * et de fouille, et la posture générale des forces de l'ordre.
 */
export type DefconRule = {
  /** Armement autorisé aux civils. */
  civilianWeapons: string;
  /** Armement porté par les agents en patrouille. */
  patrolWeapons: string;
  /** Le visage dissimulé est-il sanctionnable ? */
  concealedFace: string;
  /** Cadre des fouilles par les forces de l'ordre. */
  searchAuthority: string;
  /** Gilet pare-balles et arme d'épaule visibles ? */
  visibleGear: string;
  /** Posture générale. */
  posture: string;
};

export const DEFCON_RULES: Record<number, DefconRule> = {
  5: {
    civilianWeapons:
      "Port autorisé avec PPA valide (CCW). Armes de catégorie B pour les détenteurs en règle.",
    patrolWeapons:
      "Taser, matraque et Glock. Armes d'épaule rangées dans le coffre du véhicule.",
    concealedFace:
      "Toléré dans le cadre normal (météo, tenue). Sanctionnable seulement s'il accompagne un comportement suspect.",
    searchAuthority:
      "Fouille sur motif : infraction constatée, comportement agressif, proximité d'un point connu ou individu suspect.",
    visibleGear:
      "Gilet pare-balles et armes d'épaule interdits à la vue. Rangés dans le coffre, prêts à l'emploi.",
    posture: "Préparation normale. Service courant, patrouilles habituelles.",
  },
  4: {
    civilianWeapons:
      "Port autorisé avec PPA valide, contrôles renforcés. Vérification systématique du certificat.",
    patrolWeapons:
      "Taser, matraque et Glock. Armes d'épaule dans le coffre, sortie facilitée sur autorisation d'un superviseur.",
    concealedFace:
      "Contrôle d'identité systématique de tout individu au visage dissimulé. Sommation de se découvrir.",
    searchAuthority:
      "Fouille sur motif, avec vigilance accrue. Renseignements et signalements priorisés.",
    visibleGear:
      "Gilet pare-balles toujours rangé mais immédiatement accessible. Armes d'épaule au coffre.",
    posture:
      "Renseignements accrus et mesures de sécurité renforcées. Vigilance élevée.",
  },
  3: {
    civilianWeapons:
      "Port d'arme civil suspendu sur la voie publique, sauf professions habilitées. Toute arme apparente est saisie.",
    patrolWeapons:
      "Armes d'épaule (MP5, Remington) autorisées à proximité de la patrouille pour les agents habilités.",
    concealedFace:
      "Visage dissimulé interdit sur la voie publique. Sanctionnable et motif de contrôle immédiat.",
    searchAuthority:
      "Fouilles élargies : palpation de sécurité autorisée aux points sensibles et lors des contrôles de véhicule.",
    visibleGear:
      "Gilet pare-balles visible autorisé. Arme d'épaule tolérée en patrouille pour les agents habilités.",
    posture:
      "Accroissement de la préparation des forces, prêtes à être mobilisées en 15 minutes.",
  },
  2: {
    civilianWeapons:
      "Port d'arme civil interdit. Toute arme détenue en public est saisie et son porteur interpellé.",
    patrolWeapons:
      "Armement lourd autorisé pour les agents habilités. Le SWAT peut être déployé.",
    concealedFace:
      "Interdiction stricte du visage dissimulé. Interpellation immédiate.",
    searchAuthority:
      "Fouilles systématiques autorisées aux points de contrôle. Palpation de sécurité généralisée.",
    visibleGear:
      "Équipement de protection et arme d'épaule visibles et portés en permanence.",
    posture:
      "Préparation renforcée des forces. Appui de l'Armée mobilisable.",
  },
  1: {
    civilianWeapons:
      "Toute arme civile est prohibée. Couvre-feu possible. Détention d'arme = interpellation immédiate.",
    patrolWeapons:
      "Armement maximal. Toutes les unités spéciales sont engagées.",
    concealedFace:
      "Interdiction absolue. Tout individu masqué est considéré comme une menace.",
    searchAuthority:
      "Fouilles et contrôles sans restriction dans les zones concernées.",
    visibleGear: "Équipement de combat complet et permanent.",
    posture: "Préparation maximale des forces — état de guerre.",
  },
};

export const DEFCON_RULE_LABELS: { key: keyof DefconRule; label: string }[] = [
  { key: "posture", label: "Posture générale" },
  { key: "civilianWeapons", label: "Armement des civils" },
  { key: "patrolWeapons", label: "Armement en patrouille" },
  { key: "concealedFace", label: "Visage dissimulé" },
  { key: "searchAuthority", label: "Fouilles par les FDO" },
  { key: "visibleGear", label: "Équipement visible" },
];
