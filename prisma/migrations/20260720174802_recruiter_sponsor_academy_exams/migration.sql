-- AlterTable
ALTER TABLE `user` ADD COLUMN `recruiterId` INTEGER NULL,
    ADD COLUMN `sponsorId` INTEGER NULL,
    ALTER COLUMN `matricule` DROP DEFAULT;

-- CreateTable
CREATE TABLE `AcademyExamSubject` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `maxPoints` INTEGER NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `AcademyExamSubject_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcademyExam` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `candidateId` INTEGER NOT NULL,
    `examinerId` INTEGER NULL,
    `examinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `totalPoints` INTEGER NOT NULL DEFAULT 0,
    `maxPoints` INTEGER NOT NULL DEFAULT 0,
    `percentage` INTEGER NOT NULL DEFAULT 0,
    `passed` BOOLEAN NOT NULL DEFAULT false,
    `comment` TEXT NULL,

    INDEX `AcademyExam_candidateId_idx`(`candidateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcademyExamScore` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `examId` INTEGER NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `points` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `AcademyExamScore_examId_subjectId_key`(`examId`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_recruiterId_fkey` FOREIGN KEY (`recruiterId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_sponsorId_fkey` FOREIGN KEY (`sponsorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcademyExam` ADD CONSTRAINT `AcademyExam_candidate_fkey` FOREIGN KEY (`candidateId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcademyExam` ADD CONSTRAINT `AcademyExam_examinerId_fkey` FOREIGN KEY (`examinerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcademyExamScore` ADD CONSTRAINT `AcademyExamScore_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `AcademyExam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcademyExamScore` ADD CONSTRAINT `AcademyExamScore_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `AcademyExamSubject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
