/*
  Warnings:

  - You are about to drop the column `phon` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `phon`,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    MODIFY `role` ENUM('ADMIN', 'DOCTOR', 'REGISTRATOR', 'PATIENT', 'NURSE') NOT NULL DEFAULT 'DOCTOR';
