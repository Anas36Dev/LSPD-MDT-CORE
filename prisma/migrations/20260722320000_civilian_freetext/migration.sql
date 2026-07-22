-- Civils en texte libre : identité saisie manuellement, lien civil optionnel.
ALTER TABLE `FirearmCertificate` DROP FOREIGN KEY `FirearmCertificate_civilianId_fkey`;
ALTER TABLE `FirearmCertificate` MODIFY `civilianId` INTEGER NULL;
ALTER TABLE `FirearmCertificate` ADD COLUMN `subjectName` VARCHAR(191) NOT NULL DEFAULT '';
ALTER TABLE `FirearmCertificate` ADD CONSTRAINT `FirearmCertificate_civilianId_fkey` FOREIGN KEY (`civilianId`) REFERENCES `Civilian`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Warrant` DROP FOREIGN KEY `Warrant_civilianId_fkey`;
ALTER TABLE `Warrant` MODIFY `civilianId` INTEGER NULL;
ALTER TABLE `Warrant` ADD COLUMN `subjectName` VARCHAR(191) NOT NULL DEFAULT '';
ALTER TABLE `Warrant` ADD CONSTRAINT `Warrant_civilianId_fkey` FOREIGN KEY (`civilianId`) REFERENCES `Civilian`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Bolo` ADD COLUMN `subjectName` VARCHAR(191) NOT NULL DEFAULT '';
