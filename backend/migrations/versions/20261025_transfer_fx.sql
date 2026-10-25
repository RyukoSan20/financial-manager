-- Foreign exchange on transfers.
--
-- A transfer moves money between two accounts. When those accounts hold
-- different currencies the amount that arrives is not the amount that
-- left, so the transfer has to keep a record of what it actually did.
--
-- These columns are only filled in for a transfer between two different
-- currencies. A transfer between two accounts of the same currency leaves
-- them empty, which is how the two cases are told apart later.

ALTER TABLE transfers
    ADD COLUMN IF NOT EXISTS to_amount NUMERIC(20, 2);

ALTER TABLE transfers
    ADD COLUMN IF NOT EXISTS to_currency VARCHAR(10);

ALTER TABLE transfers
    ADD COLUMN IF NOT EXISTS fx_rate NUMERIC(20, 8);

ALTER TABLE transfers
    ADD COLUMN IF NOT EXISTS fx_rate_source VARCHAR(50);

ALTER TABLE transfers
    ADD COLUMN IF NOT EXISTS fx_rate_as_of TIMESTAMP;

-- The account holds one currency. The money in it is read in that
-- currency, so the column has to be there for every account, and it has
-- to have a value.
ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'IDR';

UPDATE accounts
    SET currency = 'IDR'
    WHERE currency IS NULL OR currency = '';

ALTER TABLE accounts
    ALTER COLUMN currency SET DEFAULT 'IDR';

-- An account that does not say which currency it holds cannot take part
-- in a transfer, because there would be no way to know what to convert.
ALTER TABLE accounts
    ALTER COLUMN currency SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_transfers_to_currency
    ON transfers(to_currency);
