-- Enquêtes du Bureau des détectives + classement académique des Rookies.
ALTER TABLE `User` ADD COLUMN `promotion` VARCHAR(191) NULL, ADD COLUMN `recruitmentSession` VARCHAR(191) NULL;

CREATE TABLE `Investigation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(191) NOT NULL,
    `leadId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `outcome` TEXT NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Investigation_reference_key`(`reference`),
    INDEX `Investigation_status_idx`(`status`),
    INDEX `Investigation_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE `InvestigationNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `investigationId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `InvestigationNote_investigationId_idx`(`investigationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE `InvestigationReport` (
    `investigationId` INTEGER NOT NULL,
    `reportId` INTEGER NOT NULL,
    `linkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `InvestigationReport_reportId_idx`(`reportId`),
    PRIMARY KEY (`investigationId`, `reportId`)
) DEFAULT CHARACTER SET utf8mb4;

ALTER TABLE `Investigation` ADD CONSTRAINT `Investigation_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `User`(`id`) ON UPDATE CASCADE;
ALTER TABLE `InvestigationNote` ADD CONSTRAINT `InvestigationNote_investigationId_fkey` FOREIGN KEY (`investigationId`) REFERENCES `Investigation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `InvestigationNote` ADD CONSTRAINT `InvestigationNote_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE CASCADE;
ALTER TABLE `InvestigationReport` ADD CONSTRAINT `InvestigationReport_investigationId_fkey` FOREIGN KEY (`investigationId`) REFERENCES `Investigation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `InvestigationReport` ADD CONSTRAINT `InvestigationReport_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
