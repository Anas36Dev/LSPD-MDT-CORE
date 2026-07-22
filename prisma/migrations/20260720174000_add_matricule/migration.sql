-- Matricule de l'agent (2 chiffres) et numéro de badge dérivé.
-- Badge = matricule + 3 chiffres aléatoires. Exemple : matricule 28 -> badge 28597.

ALTER TABLE `User` ADD COLUMN `matricule` VARCHAR(2) NOT NULL DEFAULT '00';
ALTER TABLE `User` MODIFY COLUMN `badgeNumber` VARCHAR(5) NOT NULL;
