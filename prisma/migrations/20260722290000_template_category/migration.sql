-- Catégorie de template : REPORT ou COMPLAINT.
ALTER TABLE `ReportTemplate` ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'REPORT';
