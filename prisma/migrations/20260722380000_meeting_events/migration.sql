-- Événements de réunion : avertissements, départs, décès.
CREATE TABLE `WeeklyMeetingEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `meetingId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `agentName` VARCHAR(191) NOT NULL,
    `rankName` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    INDEX `WeeklyMeetingEvent_meetingId_idx`(`meetingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;
ALTER TABLE `WeeklyMeetingEvent` ADD CONSTRAINT `WeeklyMeetingEvent_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `WeeklyMeeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WeeklyMeetingEvent` ADD CONSTRAINT `WeeklyMeetingEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
