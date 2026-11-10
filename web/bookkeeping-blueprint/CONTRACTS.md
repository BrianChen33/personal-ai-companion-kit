# Billing Center — Operation Contracts (from read-only inspection)

Source: formal `artifact.inspect` of the live Billing Center space
(structural diagnostics, 2026-11-10).
These contracts are the inspected action names, parameter shapes and
validation rules. They are NOT a verbatim copy of the server source.

## Conventions

- Transport: `POST ./actions` with JSON body `{ "action": "<name>", "input": {...} }`.
- Amounts: integer **cents** in the wallet's own currency.
- Dates: `YYYY-MM-DD`, Asia/Hong_Kong calendar days.
- Months: `YYYY-MM`.
- Native created_at and rate timestamp columns are TEXT; existing hosts may store epoch-millisecond text. Preserve the original representation, not a guessed ISO conversion.
- Currency enum (application layer only; DB column is plain TEXT, no CHECK):
  `CNY | HKD | USD | GBP | EUR | SGD | TWD`.
- A wallet `balanceCents` of `null` means "unknown": never counted in totals,
  never fabricated.
- Credit-card wallet balances are negative (debt).
- Subscriptions only amortise monthly; they never change a wallet balance.

## Actions (17)

### getOverview
- Input: `{ month: "YYYY-MM", rangeFrom: "YYYY-MM-DD", rangeTo: "YYYY-MM-DD", includeRangeTransactions?: boolean (default false) }`
  - `month` must match `^\d{4}-\d{2}$`; `rangeFrom`/`rangeTo` must match `^\d{4}-\d{2}-\d{2}$`.
- Returns: `{ wallets[], monthTransactions[], rangeTransactions[], rangeIncomeCents, rangeExpenseCents, settings: { hkdCnyRate, rateUpdatedAt, sgdHkdRate, sgdRateUpdatedAt, fxRates, displayCurrency } }`.
- `rangeTransactions` is `[]` unless `includeRangeTransactions` is true.

### getDayTransactions
- Input: `{ date: "YYYY-MM-DD" }`.
- Returns: transactions for that day (array).

### listWalletTransactions
- Input: `{ walletId: string, limit?: int 1..500 (default 100), offset?: int >= 0 (default 0) }`.
- Returns: transactions for the wallet, newest first (array).

### recordTransaction
- Input: `{ walletId: string, kind: "expense" | "income", amountCents: positive int <= 10,000,000,000, occurredOn: "YYYY-MM-DD", note?: string <= 200 }`.
- Effect: inserts the transaction and adjusts the wallet balance
  (expense reduces, income increases). A NULL balance stays NULL.
- Returns: the inserted transaction row.

### setBalance
- Input: `{ walletId: string, balanceCents: int | null }`.
- Effect: sets the wallet balance (null = unknown).
- Returns: `{ ok: true }`.

### addWallet
- Input: `{ name: string 1..100, currency: <enum>, kind: string 1..50, balanceCents?: int | null }`.
- Returns: the inserted wallet row.

### updateTransaction
- Input: `{ id: positive int, walletId?: string, kind?: "expense" | "income", amountCents?: positive int <= 10,000,000,000, occurredOn?: "YYYY-MM-DD", note?: string <= 200 }`.
- Effect: reverses the old balance effect, applies the new one.
- Returns: `{ ok: true }`.

### deleteTransaction
- Input: `{ id: positive int }`.
- Effect: deletes the row and reverses its balance effect.
- Returns: `{ ok: true }`.

### refreshRate
- Input: `{}` (empty object).
- Effect: fetches the HKD full rate table from `https://open.er-api.com/v6/latest/HKD`
  and the SGD->HKD rate from `https://open.er-api.com/v6/latest/SGD` (no API key,
  no headers). Stores `fx_rates_json` (per 1 HKD), `hkd_cny_rate`,
  `sgd_hkd_rate` and timestamps. Fallback SGD->HKD is `1 / (SGD per 1 HKD)`
  from the HKD table; the SGD dedicated line overrides it on success.
  On failure it keeps the stored rates and returns `ok: false`. Never fabricates.
- Returns: `{ ok: boolean }`.

### setDisplayCurrency
- Input: `{ currency: <enum> }`.
- Effect: sets `settings.display_currency`.
- Returns: `{ ok: true }`.

### getSyncStamp
- Input: `{}` (empty object).
- Effect: djb2 fingerprint over the full JSON of wallets + transactions +
  subscriptions + settings. The client polls this every 5 seconds while the
  page is open and refetches all data when it changes.
- Returns: `{ stamp: "{length}:{hash36}" }`.

### seedInitial
- Input: `{}` (empty object).
- Effect: only when wallets AND transactions are both empty, inserts starter
  wallets and fetches rates once. Otherwise a no-op (`{ ok: true, seeded: false }`).
- Returns: `{ ok: true, seeded: boolean }`.

### getSubscriptions
- Input: `{}` (empty object).
- Returns: `{ subscriptions: [..., monthlyCents = round(amountCents / periodMonths)], fxRates, displayCurrency }`.

### addSubscription
- Input: `{ name: string 1..100, currency: <enum>, amountCents: positive int <= 10,000,000,000, period: string 1..50, periodMonths: positive int <= 120, nextRenewalOn?: "YYYY-MM-DD" | null, startsOn?: "YYYY-MM-DD" | null, endsOn?: "YYYY-MM-DD" | null, note?: string <= 200 }`.
- Returns: the inserted subscription row.

### updateSubscription
- Input: `{ id: string, ...same optional fields as addSubscription }`.
- Returns: `{ ok: true }`.

### deleteSubscription
- Input: `{ id: string }`.
- Returns: `{ ok: true }`.

### seedSubscriptions
- Input: `{}` (empty object).
- Effect: only when subscriptions is empty, inserts starter subscriptions and
  fetches rates once. Otherwise a no-op (`{ ok: true, seeded: false }`).
- Returns: `{ ok: true, seeded: boolean }`.


## Export extension

The original 17 actions above are the baseline. For `exportSnapshot`, follow
[the current plugin protocol](../../plugins/bookkeeping/PROTOCOL.md), not an old export draft.
New hosts must confirm their actual formal action transport; this relative endpoint is not a universal public API.
Legacy seed actions are documented for recognition only; never call them against an existing ledger.
