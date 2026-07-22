-- Lien optionnel entre une fiche civile et l'agent LSPD correspondant.
ALTER TABLE `Civilian` ADD COLUMN `agentId` INTEGER NULL;
ALTER TABLE `Civilian` ADD CONSTRAINT `Civilian_agentId_key` UNIQUE (`agentId`);
ALTER TABLE `Civilian` ADD CONSTRAINT `Civilian_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
