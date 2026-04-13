-- DropIndex
DROP INDEX `User_role_idx` ON `User`;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `resetToken` VARCHAR(191) NULL,
    ADD COLUMN `resetTokenExpires` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `User_resetToken_idx` ON `User`(`resetToken`);
