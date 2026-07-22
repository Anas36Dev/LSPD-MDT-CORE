-- Casier : un fait peut réunir plusieurs motifs (infractions).
ALTER TABLE `CriminalRecord` DROP FOREIGN KEY `CriminalRecord_penalCodeId_fkey`;
ALTER TABLE `CriminalRecord` DROP COLUMN `penalCodeId`;

CREATE TABLE `CriminalRecordCharge` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `criminalRecordId` INTEGER NOT NULL,
    `penalCodeId` INTEGER NOT NULL,
    UNIQUE INDEX `CriminalRecordCharge_criminalRecordId_penalCodeId_key`(`criminalRecordId`, `penalCodeId`),
    INDEX `CriminalRecordCharge_penalCodeId_idx`(`penalCodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

ALTER TABLE `CriminalRecordCharge` ADD CONSTRAINT `CriminalRecordCharge_criminalRecordId_fkey` FOREIGN KEY (`criminalRecordId`) REFERENCES `CriminalRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CriminalRecordCharge` ADD CONSTRAINT `CriminalRecordCharge_penalCodeId_fkey` FOREIGN KEY (`penalCodeId`) REFERENCES `PenalCode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
