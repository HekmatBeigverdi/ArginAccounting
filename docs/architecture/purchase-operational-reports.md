# Purchase Queries and Operational Reports

## Status

Phase 22 Step 21 defines and implements the read-only operational reporting boundary for Purchase.

The reports are rebuildable projections over authoritative Purchase, Inventory and Valuation facts. They do not become synchronization authority and they do not create accounting postings.

## Operational Views

Step 21 exposes four bounded operational reports.

### Purchase Document Register

The register lists Purchase documents in Company/Branch/Fiscal/date scope and derives commercial totals from persisted Purchase Commercial Facts with the existing Purchase pricing engine.

Columns include:

- document identity and number;
- document type/status;
- business date;
- Supplier snapshot identity;
- line count;
- gross, discount, charge, tax base, tax and grand total;
- correction-reference identity where present.

The reader does not trust denormalized UI totals. It recalculates line/document totals from the authoritative persisted Commercial Terms.

### Supplier Activity Summary

The Supplier report groups confirmed operational Purchase activity by Supplier and currency.

It reports separately:

- Supplier Invoice count and amount;
- Purchase Return count and amount;
- Purchase Correction count and amount;
- invoice amount less confirmed return amount as `netBeforeCorrections`.

Purchase Corrections are deliberately not folded into that net amount. A correction may replace commercial facts rather than represent a simple positive/negative adjustment, so its amount remains separately visible.

Original Supplier Invoices in terminal `returned` or `corrected` status remain historical invoice activity and are included with their compensating documents shown separately.

### Invoice / Receipt Matching

Matching report rows are Supplier Invoice lines whose invoice has reached operational confirmation history.

For each line the report shows:

- Supplier and Product snapshot identity;
- invoice base quantity;
- exact matched base quantity;
- exact remaining base quantity;
- `unmatched`, `partially-matched` or `fully-matched`.

Quantity aggregation uses canonical decimal arithmetic; binary floating point is not used. Persisted over-matching is treated as an invalid dependency state rather than silently clipped.

### Unresolved Inventory Cost

The unresolved-cost report shows confirmed Inventory receipt movements sourced from Purchase that still have no Purchase-backed authoritative Cost Input.

Reasons include the Phase 22 Step 11 reasons and Desktop integration states:

- `awaiting-supplier-invoice`;
- `invoice-match-required`: a confirmed source invoice exists, but no line match has been recorded;
- `cost-input-pending`: matches and commercial facts are available, but cost persistence/delivery is incomplete;
- `partial-invoice-match`;
- `supplier-invoice-cost-unavailable`.

The report joins Inventory receipt movement, Product and Warehouse identities for operator visibility, but does not mutate Inventory or Valuation.

A fully matched receipt with valid Supplier Invoice facts remains visible as `cost-input-pending` until both the Purchase Cost Input and its Inventory-consumable basis exist. This includes interrupted delivery after Purchase persistence. Reports remain read-only; the secured Purchase workspace action performs matching and cost delivery.

## Query Scope and Bounds

`PurchaseOperationalReportQuery` supports:

- Company;
- optional Branch;
- optional Fiscal Year;
- optional Supplier where semantically meaningful;
- optional business-date range;
- limit;
- offset.

Limits are bounded to 1..500 and date ranges are normalized before persistence access.

Desktop uses a page size of 50.

Company scope is mandatory. Desktop report composition additionally enforces the current actor's persisted Branch access. Company-wide view is reserved for `system.full-access`.

The unresolved-cost view intentionally does not pretend to apply a Supplier filter before a receipt has authoritative invoice identity. Company/Branch/Fiscal/date filters remain active.

## SQLite Reader

`SqlitePurchaseOperationalReportReader` is the SQLite/Tauri adapter.

It uses:

- bounded lookahead reads for register, matching and unresolved-cost pages;
- existing Purchase repositories for aggregate/commercial/match hydration;
- existing Purchase Pricing for monetary totals;
- exact matching quantity projection from the Purchase report core.

It owns no writes.

## Desktop Workspace

Route:

- `/purchases/reports`

Navigation:

- `گزارش‌های خرید`
- group: `خرید و تدارکات`
- view permission: `purchases.documents.view`

The page is Persian RTL and contains:

1. `دفتر اسناد خرید`
2. `خلاصه تأمین‌کنندگان`
3. `تطبیق فاکتور و رسید`
4. `هزینه‌های حل‌نشده`

Date filters are entered in Jalali form and converted only when a report load is requested. Partial Jalali typing therefore cannot throw during React render.

Commercial numeric/date columns that require stable digit ordering use LTR presentation.

The workspace follows shared display-density tokens.

## Security

Viewing the operational reports reuses `purchases.documents.view`.

The dedicated `purchases.reports.export` permission remains available for export behavior, but Step 21 does not invent an export format or file workflow that was not in the frozen scope.

Report composition validates Branch scope independently of route visibility.

## Argin Bridge

Operational report rows and aggregates are rebuildable projections and are not synchronized as authoritative Bridge facts.

Bridge continues to synchronize the underlying authoritative Purchase documents, Commercial Facts, Matches and Cost Inputs defined in Step 18.

## Accounting Boundary

These reports are operational Purchase reports only.

They do not create:

- Accounts Payable aging;
- General Ledger postings;
- Journal Vouchers;
- Posting Rules;
- tax accounting entries.

Purchase accounting belongs to Phase 23.

## Verification Boundary

Step 21 adds focused report semantics, SQLite query-boundary tests and Desktop contract tests.

Exhaustive Domain/Application test expansion is Step 22.

Real SQLite/migration/cross-module/Desktop integration is Step 23.

Full monorepo validation and release reconciliation are Step 24.
