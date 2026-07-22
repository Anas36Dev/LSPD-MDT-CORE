-- Récapitulatif de réunion hebdomadaire + changements de grade annoncés.
CREATE TABLE `WeeklyMeeting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `summary` TEXT NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE `WeeklyGradeChange` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `meetingId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `agentName` VARCHAR(191) NOT NULL,
    `fromRankName` VARCHAR(191) NOT NULL,
    `toRankName` VARCHAR(191) NOT NULL,
    `direction` VARCHAR(191) NOT NULL,
    INDEX `WeeklyGradeChange_meetingId_idx`(`meetingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

ALTER TABLE `WeeklyMeeting` ADD CONSTRAINT `WeeklyMeeting_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WeeklyGradeChange` ADD CONSTRAINT `WeeklyGradeChange_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `WeeklyMeeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WeeklyGradeChange` ADD CONSTRAINT `WeeklyGradeChange_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
