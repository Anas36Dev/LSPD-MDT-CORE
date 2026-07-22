-- Refonte « Civils » → Registre des Casiers Judiciaires.
-- On repart d'une base propre : suppression de tous les civils existants
-- (les enfants partent en cascade / SetNull selon les FK).
DELETE FROM `Civilian`;

-- Enrichissement de la fiche (= casier judiciaire).
ALTER TABLE `Civilian`
  ADD COLUMN `reference` VARCHAR(191) NOT NULL,
  ADD COLUMN `placeOfBirth` VARCHAR(191) NULL,
  ADD COLUMN `nationality` VARCHAR(191) NULL,
  ADD COLUMN `hasTattoos` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `tattoosDescription` VARCHAR(191) NULL,
  ADD COLUMN `groupuscule` VARCHAR(191) NULL,
  ADD COLUMN `authorId` INTEGER NOT NULL,
  ADD COLUMN `authorSignature` VARCHAR(191) NULL,
  ADD COLUMN `validatedById` INTEGER NULL,
  ADD COLUMN `validatedAt` DATETIME(3) NULL,
  ADD COLUMN `validationSignature` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Civilian_reference_key` ON `Civilian`(`reference`);
CREATE INDEX `Civilian_authorId_idx` ON `Civilian`(`authorId`);
ALTER TABLE `Civilian`
  ADD CONSTRAINT `Civilian_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `Civilian_validatedById_fkey` FOREIGN KEY (`validatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Infraction : sous-référence, auteur, observations.
ALTER TABLE `CriminalRecord`
  ADD COLUMN `reference` VARCHAR(191) NULL,
  ADD COLUMN `authorId` INTEGER NOT NULL,
  ADD COLUMN `observations` TEXT NULL;

CREATE INDEX `CriminalRecord_authorId_idx` ON `CriminalRecord`(`authorId`);
ALTER TABLE `CriminalRecord`
  ADD CONSTRAINT `CriminalRecord_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Liaisons rapports (fiche + infraction) et renvois entre infractions.
CREATE TABLE `CivilianReport` (
  `civilianId` INTEGER NOT NULL,
  `reportId` INTEGER NOT NULL,
  `linkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`civilianId`, `reportId`),
  INDEX `CivilianReport_reportId_idx` (`reportId`),
  CONSTRAINT `CivilianReport_civilianId_fkey` FOREIGN KEY (`civilianId`) REFERENCES `Civilian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CivilianReport_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CriminalRecordReport` (
  `criminalRecordId` INTEGER NOT NULL,
  `reportId` INTEGER NOT NULL,
  `linkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`criminalRecordId`, `reportId`),
  INDEX `CriminalRecordReport_reportId_idx` (`reportId`),
  CONSTRAINT `CriminalRecordReport_criminalRecordId_fkey` FOREIGN KEY (`criminalRecordId`) REFERENCES `CriminalRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CriminalRecordReport_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CriminalRecordLink` (
  `fromId` INTEGER NOT NULL,
  `toId` INTEGER NOT NULL,
  PRIMARY KEY (`fromId`, `toId`),
  INDEX `CriminalRecordLink_toId_idx` (`toId`),
  CONSTRAINT `CriminalRecordLink_fromId_fkey` FOREIGN KEY (`fromId`) REFERENCES `CriminalRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CriminalRecordLink_toId_fkey` FOREIGN KEY (`toId`) REFERENCES `CriminalRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
