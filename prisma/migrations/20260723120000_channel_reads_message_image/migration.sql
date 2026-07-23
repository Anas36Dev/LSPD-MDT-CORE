-- AlterTable : pièce jointe image sur les messages directs
-- (PascalCase obligatoire : MariaDB Linux est sensible à la casse des tables.)
ALTER TABLE `Message` ADD COLUMN `imageUrl` TEXT NULL;

-- CreateTable : suivi de lecture par canal (messages de groupe non lus)
CREATE TABLE `ChannelRead` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `lastReadAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChannelRead_userId_channel_key`(`userId`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChannelRead` ADD CONSTRAINT `ChannelRead_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
