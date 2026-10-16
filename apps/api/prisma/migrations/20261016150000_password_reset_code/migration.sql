-- AlterTable
ALTER TABLE `verification_codes` MODIFY `purpose` ENUM('REGISTRATION', 'LOGIN', 'PASSWORD_RESET') NOT NULL;
