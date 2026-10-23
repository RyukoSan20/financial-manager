-- Link the two halves of a transfer.
--
-- A transfer creates a transfer_out transaction on the source account and
-- a transfer_in transaction on the destination account. The transfer_out row
-- points at the transfer_in row through this column, so the pair can be
-- found again later. The column was missing from the model as well, which
-- made every transfer request fail with a 500.

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS transfer_to_transaction_id INTEGER REFERENCES transactions(id);

CREATE INDEX IF NOT EXISTS ix_transactions_transfer_to_transaction_id
    ON transactions(transfer_to_transaction_id);
