-- What an account is called, and where it is held.

-- A reader can hold money in more than one currency. A rupiah savings
-- account and a yen savings account are not the same thing, and they
-- are usually held at different places. These columns say which kind
-- of holding this is and where it is kept.

ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);

ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS account_kind VARCHAR(50);

-- Existing rows get the kind that matches their account type, so the
-- column is never empty on an account that already exists.
UPDATE accounts
SET account_kind = account_type
WHERE account_kind IS NULL OR account_kind = '';
