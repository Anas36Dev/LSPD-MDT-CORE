-- AlterTable
ALTER TABLE `user` ADD COLUMN `dutySince` DATETIME(3) NULL,
    ADD COLUMN `dutyStatus` ENUM('OFF_DUTY', 'AVAILABLE', 'BUSY', 'ON_SCENE', 'BREAK') NOT NULL DEFAULT 'OFF_DUTY';

-- CreateTable
CREATE TABLE `DepartmentStatus` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `defconLevel` INTEGER NOT NULL DEFAULT 5,
    `defconReason` TEXT NULL,
    `updatedById` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Patrol` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `callSign` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'AVAILABLE',
    `sector` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Patrol_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PatrolMember` (
    `patrolId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `isLead` BOOLEAN NOT NULL DEFAULT false,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PatrolMember_userId_key`(`userId`),
    PRIMARY KEY (`patrolId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DepartmentStatus` ADD CONSTRAINT `DepartmentStatus_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Patrol` ADD CONSTRAINT `Patrol_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatrolMember` ADD CONSTRAINT `PatrolMember_patrolId_fkey` FOREIGN KEY (`patrolId`) REFERENCES `Patrol`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatrolMember` ADD CONSTRAINT `PatrolMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
