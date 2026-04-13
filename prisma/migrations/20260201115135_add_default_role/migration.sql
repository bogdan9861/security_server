-- DropForeignKey
ALTER TABLE `Notification` DROP FOREIGN KEY `Notification_ticketId_fkey`;

-- DropIndex
DROP INDEX `Notification_ticketId_fkey` ON `Notification`;

-- AlterTable
ALTER TABLE `Notification` MODIFY `ticketId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('CLIENT', 'OPERATOR', 'ADMIN') NOT NULL DEFAULT 'CLIENT';

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
