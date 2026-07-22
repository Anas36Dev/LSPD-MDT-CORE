-- Dossiers de preuves et pièces.
CREATE TABLE `EvidenceFolder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `authorId` INTEGER NOT NULL,
    `investigationId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `EvidenceFolder_reference_key`(`reference`),
    INDEX `EvidenceFolder_authorId_idx`(`authorId`),
    INDEX `EvidenceFolder_investigationId_idx`(`investigationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE `EvidenceItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `folderId` INTEGER NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'IMAGE',
    `url` TEXT NOT NULL,
    `caption` VARCHAR(191) NULL,
    `addedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `EvidenceItem_folderId_idx`(`folderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

ALTER TABLE `EvidenceFolder` ADD CONSTRAINT `EvidenceFolder_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `EvidenceFolder` ADD CONSTRAINT `EvidenceFolder_investigationId_fkey` FOREIGN KEY (`investigationId`) REFERENCES `Investigation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `EvidenceItem` ADD CONSTRAINT `EvidenceItem_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `EvidenceFolder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EvidenceItem` ADD CONSTRAINT `EvidenceItem_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
