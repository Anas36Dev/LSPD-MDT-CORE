-- Éléments d'information rattachés à une enquête.
CREATE TABLE `InvestigationInfo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `investigationId` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `authorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `InvestigationInfo_investigationId_idx`(`investigationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;
ALTER TABLE `InvestigationInfo` ADD CONSTRAINT `InvestigationInfo_investigationId_fkey` FOREIGN KEY (`investigationId`) REFERENCES `Investigation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `InvestigationInfo` ADD CONSTRAINT `InvestigationInfo_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE CASCADE;
