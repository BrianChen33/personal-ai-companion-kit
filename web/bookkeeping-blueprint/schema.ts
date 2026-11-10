// server/src/schema.ts — Drizzle table definitions (reconstructed from inspected schema).
// Amounts are integer cents in the wallet's own currency. A credit-card wallet
// balance is negative (debt). A NULL balance_cents means "unknown" and must
// never be counted in totals or fabricated. Currency is plain TEXT; the
// seven-currency enum (CNY/HKD/USD/GBP/EUR/SGD/TWD) is enforced at the
// application layer (zod), not by a DB CHECK.
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const wallets = sqliteTable("wallets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull(),
  kind: text("kind").notNull(),
  balanceCents: integer("balance_cents"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    walletId: text("wallet_id")
      .notNull()
      .references(() => wallets.id),
    kind: text("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    note: text("note").notNull().default(""),
    occurredOn: text("occurred_on").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_transactions_occurred_on").on(t.occurredOn),
    index("idx_transactions_wallet").on(t.walletId),
  ],
);

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  hkdCnyRate: real("hkd_cny_rate"),
  rateUpdatedAt: text("rate_updated_at"),
  sgdHkdRate: real("sgd_hkd_rate"),
  sgdRateUpdatedAt: text("sgd_rate_updated_at"),
  fxRatesJson: text("fx_rates_json"),
  displayCurrency: text("display_currency"),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull(),
  amountCents: integer("amount_cents").notNull(),
  period: text("period").notNull(),
  periodMonths: integer("period_months").notNull(),
  nextRenewalOn: text("next_renewal_on"),
  startsOn: text("starts_on"),
  endsOn: text("ends_on"),
  note: text("note").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const CURRENCIES = ["CNY", "HKD", "USD", "GBP", "EUR", "SGD", "TWD"] as const;
export type Currency = (typeof CURRENCIES)[number];
