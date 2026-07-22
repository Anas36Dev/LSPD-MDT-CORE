-- Date de réunion + signature du récapitulatif.
ALTER TABLE `WeeklyMeeting` ADD COLUMN `meetingDate` DATETIME(3) NULL;
ALTER TABLE `WeeklyMeeting` ADD COLUMN `signature` VARCHAR(191) NULL;
