/*
  Warnings:

  - Added the required column `conversation_id` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `messages` DROP FOREIGN KEY `messages_call_id_fkey`;

-- DropIndex
DROP INDEX `messages_call_id_created_at_idx` ON `messages`;

-- AlterTable
ALTER TABLE `messages` ADD COLUMN `conversation_id` INTEGER NOT NULL,
    ADD COLUMN `read_at` DATETIME(3) NULL,
    MODIFY `call_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `conversations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NOT NULL,
    `translator_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_message_at` DATETIME(3) NULL,

    INDEX `conversations_translator_id_idx`(`translator_id`),
    UNIQUE INDEX `conversations_client_id_translator_id_key`(`client_id`, `translator_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `messages_conversation_id_created_at_idx` ON `messages`(`conversation_id`, `created_at`);

-- CreateIndex
CREATE INDEX `messages_call_id_idx` ON `messages`(`call_id`);

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_translator_id_fkey` FOREIGN KEY (`translator_id`) REFERENCES `translator_profiles`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_call_id_fkey` FOREIGN KEY (`call_id`) REFERENCES `calls`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
