-- Structural reference for a NEW EMPTY database only. Derived from inspection, not original source.
CREATE TABLE `wallets` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `name` TEXT NOT NULL,
  `currency` TEXT NOT NULL,
  `kind` TEXT NOT NULL,
  `balance_cents` INTEGER,
  `sort_order` INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE `transactions` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `wallet_id` TEXT NOT NULL REFERENCES `wallets`(`id`),
  `kind` TEXT NOT NULL,
  `amount_cents` INTEGER NOT NULL,
  `note` TEXT NOT NULL DEFAULT '',
  `occurred_on` TEXT NOT NULL,
  `created_at` TEXT NOT NULL
);
CREATE INDEX `idx_transactions_occurred_on` ON `transactions` (`occurred_on`);
CREATE INDEX `idx_transactions_wallet` ON `transactions` (`wallet_id`);

CREATE TABLE `settings` (
  `id` INTEGER PRIMARY KEY NOT NULL,
  `hkd_cny_rate` REAL,
  `rate_updated_at` TEXT
);
-- 0003_add_subscriptions_and_sgd_rate.sql (reconstructed from inspected schema)
CREATE TABLE `subscriptions` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `name` TEXT NOT NULL,
  `currency` TEXT NOT NULL,
  `amount_cents` INTEGER NOT NULL,
  `period` TEXT NOT NULL,
  `period_months` INTEGER NOT NULL,
  `next_renewal_on` TEXT,
  `starts_on` TEXT,
  `ends_on` TEXT,
  `note` TEXT NOT NULL DEFAULT '',
  `sort_order` INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE `settings` ADD COLUMN `sgd_hkd_rate` REAL;
ALTER TABLE `settings` ADD COLUMN `sgd_rate_updated_at` TEXT;
-- 0004_add_fx_rates_and_display_currency.sql (reconstructed from inspected schema)
ALTER TABLE `settings` ADD COLUMN `fx_rates_json` TEXT;
ALTER TABLE `settings` ADD COLUMN `display_currency` TEXT;
