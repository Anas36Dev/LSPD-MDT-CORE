-- Documents de division + notes de supervision + visibilité des documents d'académie.
ALTER TABLE `AcademyDocument` ADD COLUMN `visibility` VARCHAR(191) NOT NULL DEFAULT 'ALL';

CREATE TABLE `DivisionDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `divisionId` INTEGER NOT NULL,
    `subDivisionId` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `fileUrl` VARCHAR(191) NULL,
    `authorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `DivisionDocument_divisionId_idx`(`divisionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE `AgentNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subjectId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `divisionCode` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `AgentNote_subjectId_idx`(`subjectId`),
    INDEX `AgentNote_divisionCode_idx`(`divisionCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

ALTER TABLE `DivisionDocument` ADD CONSTRAINT `DivisionDocument_divisionId_fkey` FOREIGN KEY (`divisionId`) REFERENCES `Division`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DivisionDocument` ADD CONSTRAINT `DivisionDocument_subDivisionId_fkey` FOREIGN KEY (`subDivisionId`) REFERENCES `SubDivision`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DivisionDocument` ADD CONSTRAINT `DivisionDocument_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE CASCADE;
ALTER TABLE `AgentNote` ADD CONSTRAINT `AgentNote_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AgentNote` ADD CONSTRAINT `AgentNote_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE CASCADE;
