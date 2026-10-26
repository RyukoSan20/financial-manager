-- Categories carry the same name in every language.
--
-- The name column stays as it is so nothing that already reads it
-- breaks. Two more columns hold the English and the Japanese name, and
-- system_key names the built-in category in a way that does not depend
-- on any language at all.
--
-- A category that has a system_key is one of the built-in ones. Its
-- name is then read from the translation files, so a change of the
-- wording in one language never touches the database.

ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS name_en VARCHAR(100),
    ADD COLUMN IF NOT EXISTS name_ja VARCHAR(100),
    ADD COLUMN IF NOT EXISTS system_key VARCHAR(60);

CREATE INDEX IF NOT EXISTS idx_categories_system_key ON categories(system_key);

-- The shared categories that the application ships with.
-- The names here are the same ones the seed used, so the seed and the
-- database cannot drift apart.
UPDATE categories SET
    system_key = 'salary', name_en = 'Salary', name_ja = '給与'
    WHERE user_id IS NULL AND name = 'Gaji' AND system_key IS NULL;

UPDATE categories SET
    system_key = 'freelance', name_en = 'Freelance', name_ja = 'フリーランス'
    WHERE user_id IS NULL AND name = 'Freelance' AND system_key IS NULL;

UPDATE categories SET
    system_key = 'investment_income', name_en = 'Investment', name_ja = '投資収入'
    WHERE user_id IS NULL AND name = 'Investasi' AND type = 'income' AND system_key IS NULL;

UPDATE categories SET
    system_key = 'bonus', name_en = 'Bonus', name_ja = 'ボーナス'
    WHERE user_id IS NULL AND name = 'Bonus' AND system_key IS NULL;

UPDATE categories SET
    system_key = 'other_income', name_en = 'Other (Income)', name_ja = 'その他（収入）'
    WHERE user_id IS NULL AND name = 'Lainnya (Income)' AND system_key IS NULL;

UPDATE categories SET
    system_key = 'food_drink', name_en = 'Food & Drink', name_ja = '飲食'
    WHERE user_id IS NULL AND name = 'Makanan & Minuman' AND system_key IS NULL;

UPDATE categories SET
    system_key = 'transportation', name_en = 'Transportation', name_ja = '交通'
    WHERE user_id IS NULL AND name = 'Transportasi' AND system_key IS NULL;

UPDATE categories SET
    system_key = 'shopping', name_en = 'Shopping', name_ja = '買い物'
    WHERE user_id IS NULL AND name = 'Belanja' AND system_key IS NULL;

UPDATE categories SET
    system_key = 'health', name_en = 'Health', name_ja = '健康'
    WHERE user_id IS NULL AND name = 'Kesehatan' AND system_key IS NULL;

UPDATE categories SET
    system_key = 'education', name_en = 'Education', name_ja = '教育'
    WHERE user_id IS NULL AND name = 'Pendidikan' AND system_key IS NULL;

UPDATE categories SET
    system_key = 'entertainment', name_en = 'Entertainment', name_ja = '娯楽'
    WHERE user_id IS NULL AND name = 'Hiburan' AND system_key IS NULL;

UPDATE categories SET
    system_key = 'bills_utilities', name_en = 'Bills & Utilities', name_ja = '公共料金'
    WHERE user_id IS NULL AND name = 'Tagihan & Utilitas' AND system_key IS NULL;

UPDATE categories SET
    system_key = 'savings_investment', name_en = 'Investment & Savings', name_ja = '投資・貯蓄'
    WHERE user_id IS NULL AND name = 'Investasi & Tabungan' AND system_key IS NULL;

UPDATE categories SET
    system_key = 'other_expense', name_en = 'Other (Expense)', name_ja = 'その他（支出）'
    WHERE user_id IS NULL AND name = 'Lainnya (Expense)' AND system_key IS NULL;

-- A user who already has their own copy of a built-in category gets
-- the key too, so the two stay in step.
UPDATE categories SET system_key = 'salary'
    WHERE user_id IS NOT NULL AND name = 'Gaji' AND system_key IS NULL;
UPDATE categories SET system_key = 'food_drink'
    WHERE user_id IS NOT NULL AND name = 'Makanan & Minuman' AND system_key IS NULL;
