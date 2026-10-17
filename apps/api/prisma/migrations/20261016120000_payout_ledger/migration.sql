-- Payout ledger rule: the PAYOUT entry is posted as COMPLETED when the money is taken from the balance.
-- Old PENDING entries were already debited; old FAILED entries are cancelled by their COMPLETED REFUND entry.
UPDATE `transactions` SET `status` = 'COMPLETED' WHERE `type` = 'PAYOUT' AND `status` IN ('PENDING', 'FAILED');
