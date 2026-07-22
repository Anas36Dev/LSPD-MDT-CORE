-- Accès aux canaux par division et par habilitation.
ALTER TABLE `MessageChannel` ADD COLUMN `divisionCodes` JSON NULL;
ALTER TABLE `MessageChannel` ADD COLUMN `certCodes` JSON NULL;
