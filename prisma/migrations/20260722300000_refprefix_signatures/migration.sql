-- Préfixe de référence par template + signatures officielles.
ALTER TABLE `ReportTemplate` ADD COLUMN `referencePrefix` VARCHAR(191) NOT NULL DEFAULT 'LSPD';
ALTER TABLE `Report` ADD COLUMN `authorSignature` VARCHAR(191) NULL;
ALTER TABLE `ReportValidation` ADD COLUMN `signature` VARCHAR(191) NULL;
ALTER TABLE `Warrant` ADD COLUMN `signature` VARCHAR(191) NULL;
ALTER TABLE `Bolo` ADD COLUMN `signature` VARCHAR(191) NULL;
