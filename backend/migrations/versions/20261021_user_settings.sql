CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  theme VARCHAR(20) NOT NULL DEFAULT 'light',
  language VARCHAR(10) NOT NULL DEFAULT 'id',
  currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
  date_format VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
  start_of_week VARCHAR(10) NOT NULL DEFAULT 'monday',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
  auto_backup BOOLEAN NOT NULL DEFAULT FALSE,
  biometric_login BOOLEAN NOT NULL DEFAULT FALSE,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  transaction_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  budget_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_summary BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_summary BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_frequency VARCHAR(10) NOT NULL DEFAULT 'weekly',
  reminder_days_before INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_requests (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  email VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  response TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_support_requests_user_id ON support_requests(user_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
