# Purchase SQLite Persistence and Unit of Work

Phase 22 Step 16 implements the persistence adapter for the contracts frozen in Steps 13–15.

## Package Boundary

`@argin/purchase-tauri` owns the concrete SQLite repositories and `SqlitePurchaseUnitOfWork`.

`@argin/purchase` remains persistence-neutral and does not import SQLite, Tauri, SQL table names or `@argin/database-tauri`.

The adapter depends only on:

- `@argin/database` for `DatabaseExecutor` / `DatabaseSession`;
- `@argin/purchase` for Domain/Application contracts and rehydration.

Production Desktop composition can supply `@argin/database-tauri`, whose `transaction()` implementation pins one SQLite connection and executes `BEGIN IMMEDIATE / COMMIT / ROLLBACK`.

## Repositories

### `SqlitePurchaseDocumentRepository`

Implements document lookup/list/add/update.

- `findById` and `findByNumber` rehydrate through Purchase Domain invariants.
- bounded list queries implement the Step 13 filters and pagination.
- add persists header, lines and any lifecycle facts on one transaction-bound session.
- update uses compare-and-swap with `WHERE company_id=? AND id=? AND version=?`.
- a stale existing row maps to `PURCHASE_APP_VERSION_CONFLICT`; a missing row maps to `PURCHASE_APP_NOT_FOUND`.
- lifecycle history is appended; old lifecycle facts are never updated/deleted.
- document update does not rewrite line snapshots.

### `SqlitePurchaseCommercialFactRepository`

Persists one authoritative commercial snapshot per Purchase line.

Rehydration parses the JSON snapshot and recreates it through `createPurchaseCommercialTerms`, then cross-checks normalized quantity/unit/price/currency/tax columns against the JSON fact. Corrupt disagreement is rejected as a dependency error.

`replaceBatch` is revision-aware and uses compare-and-swap per line.

### `SqlitePurchaseReceiptInvoiceMatchRepository`

Reads and appends the immutable match facts introduced in Step 8. It writes only `purchase_receipt_invoice_matches`; Inventory receipt rows are read-only foreign authority.

### `SqlitePurchaseValuationCostInputRepository`

Persists and replaces Purchase-owned Cost Input provenance for one Inventory movement.

It does not calculate FIFO/MWA and does not write Inventory or Inventory Valuation tables. Cost-basis JSON is cross-checked against indexed columns during rehydration.

`listUnresolvedByCompany` derives unresolved Purchase-backed inbound receipts from the authoritative Inventory movement/document feed plus Purchase matches/commercial facts:

- no match → `awaiting-supplier-invoice`;
- incomplete movement coverage → `partial-invoice-match`;
- full coverage but missing confirmed commercial source → `supplier-invoice-cost-unavailable`.

A fully covered movement with available confirmed Purchase commercial facts is not mislabeled unresolved merely because the Application command has not persisted its Cost Input yet.

## Fiscal Scope Snapshot Correction

Step 16 exposed a Step 15 persistence gap: `PurchaseDocumentScope` contains historical Fiscal date/status/lock facts in addition to Fiscal IDs.

Migration `0031_purchase_scope_snapshot.sql` therefore adds:

- fiscal-year start/end;
- fiscal-period start/end;
- captured fiscal-year status;
- captured fiscal-period status;
- captured `lockedThroughDate`.

New writes must contain a valid scope snapshot. The repository rehydrates from the captured historical facts; it never reconstructs history from current Fiscal state.

## Unit of Work

`SqlitePurchaseUnitOfWork.execute()` calls exactly one `DatabaseExecutor.transaction()` and creates all four repositories over that same `DatabaseSession`.

`sessionFor(context)` exists only for explicit same-transaction composition and is valid only while the callback is active. The mapping is removed on both success and failure.

The adapter does not begin nested transactions.

## Ownership Rules

Purchase SQLite code may read Inventory rows required by the Purchase contracts, but must never write:

- `inventory_documents`;
- `inventory_document_lines`;
- `inventory_stock_movements`;
- Inventory balance projections;
- Inventory Valuation entries/layers/states.

Inventory quantity side effects still go through the Inventory ports from Step 14, and Phase 21 remains authoritative for valuation.

## Step Boundaries

Step 16 does not finalize:

- idempotency replay/fingerprint conflict semantics — Step 17;
- Argin Bridge envelopes/conflict rules — Step 18;
- permissions/approval/audit — Step 19;
- Desktop Purchase workspace — Step 20;
- full real-database restart/rollback/upgrade matrix — Steps 23–24.

## Verification Evidence

Focused Step 16 evidence:

- adapter contract tests were committed before production adapter files existed;
- static verification against the final GitHub source confirms four repositories, CAS SQL, Domain rehydration, one-transaction UoW and absence of Inventory writes;
- focused executable UoW verification: 2 passed, 0 failed, covering success and rollback cleanup;
- SQLite execution of the scope-snapshot migration passed and rejected invalid insert/update scope snapshots;
- direct clone/full package execution in this session remains blocked by DNS resolution for `github.com`; no full-package pass is claimed.
