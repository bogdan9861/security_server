-- DropForeignKey
ALTER TABLE `Attachment` DROP FOREIGN KEY `Attachment_ticketId_fkey`;

-- DropForeignKey
ALTER TABLE `Comment` DROP FOREIGN KEY `Comment_ticketId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketHistory` DROP FOREIGN KEY `TicketHistory_ticketId_fkey`;

-- DropIndex
DROP INDEX `Attachment_ticketId_fkey` ON `Attachment`;

-- DropIndex
DROP INDEX `Comment_ticketId_fkey` ON `Comment`;

-- DropIndex
DROP INDEX `TicketHistory_ticketId_fkey` ON `TicketHistory`;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketHistory` ADD CONSTRAINT `TicketHistory_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
