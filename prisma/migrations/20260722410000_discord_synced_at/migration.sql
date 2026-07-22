-- Horodatage de la dernière synchro avatar/pseudo Discord (rafraîchissement auto).
ALTER TABLE `User` ADD COLUMN `discordSyncedAt` DATETIME(3) NULL;
