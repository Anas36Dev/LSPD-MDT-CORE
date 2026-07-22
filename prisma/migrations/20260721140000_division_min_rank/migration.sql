-- Grade minimum configurable par division (géré par le Command Staff).
ALTER TABLE `Division` ADD COLUMN `minRankLevel` INTEGER NOT NULL DEFAULT 38;
UPDATE `Division` SET `minRankLevel` = 37 WHERE `code` = 'PATROL';
