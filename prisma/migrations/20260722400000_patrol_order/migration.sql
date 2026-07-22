-- Ordre d'affichage des patrouilles sur le tableau de dispatch (glisser-déposer).
ALTER TABLE `Patrol` ADD COLUMN `order` INTEGER NOT NULL DEFAULT 0;
