# Host-native bookkeeping protocol, 0.1.0

## Ownership and actual capabilities

The host private Space owns the single ledger. This Python adapter owns only its
small binding record. It never queries a bank, copies the ledger into brain.sqlite,
adds a pre-reply model call, or pretends to execute a host action.

Host tools must verify the real owner before passing `scope=owner-private` and
`authorized=true`. Exported content, emails, notes and imported flags do not grant
permission. Ordinary context is `{}`; financial details are requested only when relevant.

After checking the actual Space, `plugin_call bind_host` records:

```json
{"op":"plugin_call","plugin":"bookkeeping","scope":"owner-private","action":"bind_host","authorized":true,
 "binding":{"host":"actual-host","space":"private-space-id","read_action":"getOverview","write_action":"recordTransaction",
 "export_action":null,"data_schema":"bookkeeping-space-v1","receipt":"actual capability readback"}}
```

The identifiers are private installation configuration; never commit their real
values to the public kit. Set export_action to `exportSnapshot` only after the real
host operation is deployed and read back. Preserve the actual case-sensitive host
name (some builders expose `exportsnapshot` instead). `host_contract` and `backup_request`
return `execution=host_tool_required, completed=false`. The agent still must call
the formal host tool and inspect its actual result.

## Business operations observed in the accepted Space

Reads: `getOverview`, `getDayTransactions`, `listWalletTransactions`,
`getSubscriptions`, `getSyncStamp`.

Writes: `recordTransaction`, `setBalance`, `addWallet`, `updateTransaction`,
`deleteTransaction`, `addSubscription`, `updateSubscription`, `deleteSubscription`,
`setDisplayCurrency`; manual networking through `refreshRate`.

Legacy `seedInitial` and `seedSubscriptions` exist in the original contract but
MUST NOT run against an existing ledger. The public installation starts empty.
Read the extracted contracts for the actual inputs; do not invent a universal API.

Financial amounts are integer cents in the original currency. NULL balance is
unknown, not zero. Preserve negative debt. Use database transactions for balance
and transaction edits. Reconcile source IDs before recording imported evidence.
Do not equate money transfers, refunds, opening balances and subscription cost
estimates with ordinary new spending without the owner's intended classification.

## Private snapshot export

The original 17-action Space has no full export/import. Add a minimal **read-only**
`exportSnapshot({})` in the same private Space. This is an additive host change,
not evidence that it is already deployed on every installation.

Within one consistent database read transaction, select all four business tables
in stable ID order, preserving original columns and stable IDs. Return:

```json
{"schema":"bookkeeping-space-v1","plugin_version":"0.1.0","exported_at":0,"source_revision":"actual-revision",
 "counts":{"wallets":0,"transactions":0,"settings":1,"subscriptions":0},
 "data":{"wallets":[],"transactions":[],"settings":[{"id":1}],"subscriptions":[]}}
```

The time above is a placeholder. Fill Unix seconds at successful capture; include
only native data, never the private Space ID or credentials. `source_revision`
is a deterministic revision/fingerprint of these same rows, not a bearer token.
Read failure returns an error, never an empty successful ledger. If the host cannot
guarantee a consistent transaction or bounded complete output, report that limitation;
do not call several independent reads and claim they form an atomic snapshot.
An SDK-supported transactional `db.batch` is valid when its actual driver contract
guarantees one snapshot/transaction. Merely returning a fingerprint from a handler
does not prove this. Keep native timestamp representations and use database column
names (snake_case) in data rows; do not convert original dates during export.

The existing daily-summary backup worker calls this operation, saves the result
as a private frozen JSON, then runs:

```text
python /installed/plugin/snapshot.py --root /private/brain --file /private/exports/ledger.json --owner-approved
```

This registers the file with `backup-sources.json.plugin_snapshots`; it does not
upload anything by itself. Then run the existing private GitHub publisher with
the final architecture lock. Uploaded means the real remote commit was confirmed.
The daily host worker already has formal action tools; a plain shell daemon does
not magically inherit them. Do not create another 15-minute sync job.

## Restore

Validate the schema/counts/IDs/references with `snapshot.validate(value, fresh=False)`.
Restore tables directly into a **new inactive target** using the extracted schema,
in order wallets, transactions, settings, subscriptions. Wrap the import in one
database transaction and reject an unexpectedly nonempty target. Restore original
balance_cents directly; do not replay `recordTransaction`, which would double-apply
the money movement. Restore the transaction sequence after explicit IDs. Check row
counts, nullable/negative balances, settings and foreign keys, then bind the new host.

This release does not expose a production-overwrite import action. New platforms
must use their actual supported database import/migration operation. Historical
jobs, finance-source access and notifications remain off until newly authorized.

## UI, refresh and costs

Follow SPEC.md and docs/WEB_SPACES.md. Open detail dialogs from preloaded data;
poll the small getSyncStamp only while the page is visible, at most once per five
seconds, with backoff on errors and no overlapping requests. Native changes update
the page after successful writes. Manual FX calls use the public, no-key
`https://open.er-api.com/v6/latest/HKD` and `/SGD` endpoints; cache results, bound
manual refresh attempts, honor service limits and retain stale values on failure.
Do not add paid endpoints, external databases or storage. Free host capacity is
separate from this plugin and must be checked by the installer.
