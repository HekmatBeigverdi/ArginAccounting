# Phase 22 — Purchase Workflow — Release Notes

## Release

- Version: `0.22.0`
- Tag: `v0.22.0`
- Title: `ArginAccounting v0.22.0 — Purchase Workflow`

## Highlights

Phase 22 introduces the supplier Purchase commercial workflow for ArginAccounting and connects confirmed Purchase facts to Inventory quantity movements and Inventory Valuation Cost Inputs without duplicating commercial price ownership.

### Purchase Documents

- Purchase Order, Supplier Invoice, Purchase Return and Purchase Correction document types.
- Durable Company/Branch/Fiscal scope with historical scope snapshot.
- Draft, submitted, approved, confirmed, cancelled, returned and corrected lifecycle.
- Confirmed history remains immutable; Return/Correction use linked compensating documents.
- Fiscal/Branch-scoped numbering through the shared Number Series engine.

### Supplier, Product and Commercial Snapshots

- Historical Supplier and Product/Service snapshots preserved on Purchase documents.
- Product/Service and stock/non-stock distinctions remain explicit.
- Taxpayer goods/service and unit identity remains compatible with Iranian Taxpayer System requirements.
- Commercial values are captured once in Purchase rather than re-entered in Inventory Valuation.

### Commercial Pricing

- Exact decimal quantity semantics.
- Safe-integer monetary values in explicit currency.
- Ordered discounts and charges.
- Explicit tax treatment and basis-point rates.
- Deterministic half-away-from-zero rounding.
- Gross, net, tax base, VAT and grand totals derived from authoritative Commercial Facts.

### Inventory Receipt Integration

- Confirmed Purchase stock intent stages Inventory-owned receipt drafts.
- Purchase never writes StockMovement facts directly.
- Durable Purchase source document/line identity is preserved on Inventory receipt lines.
- Duplicate source receipts are prevented by the Inventory boundary.
- Service and non-stock Purchase lines do not create stock movements solely because they were purchased.

### Receipt / Invoice Matching

- Durable line-level Match facts connect confirmed Supplier Invoice lines to confirmed Inventory receipt lines.
- Matching uses canonical base quantity.
- Over-allocation of invoice or receipt quantity is rejected.
- Unmatched, partially matched and fully matched states remain derived projections.
- Match facts are append-only.

### Inventory Valuation Cost Input

- Normal stock Purchase cost is delivered automatically from confirmed Supplier Invoice commercial facts.
- Inventory cost basis uses Purchase tax base after discounts/charges and excludes recoverable VAT from normal stock cost.
- Receipt-before-invoice remains explicitly unresolved until authoritative Supplier Invoice cost exists.
- Missing or partial cost is never silently converted to zero.
- Resolved Purchase Cost Input is committed before Inventory Valuation recalculation is requested.
- Existing manual Inventory Cost Input is protected from automatic Purchase overwrite.

### Return and Correction

- Purchase Return creates compensating outbound Inventory intent without rewriting the original receipt.
- Purchase Correction supports commercial replacement and quantity increase/decrease effects.
- Quantity changes use follow-up Inventory effects rather than editing immutable movements.
- Historical cost changes declare deterministic `cost_basis_changed` recalculation from affected movements.

### SQLite and Replay Safety

- Migrations:
  - `0030_purchase_workflow.sql`
  - `0031_purchase_scope_snapshot.sql`
  - `0032_purchase_replay_safety.sql`
- Durable Purchase Document, line, lifecycle, Commercial Fact, Match, Cost Input and idempotency persistence.
- One transaction-bound Purchase Unit of Work.
- Optimistic concurrency with expected-version compare-and-swap.
- Durable request ID + operation ID + payload fingerprint replay identity.
- Exact successful retries return persisted outcomes without duplicating Purchase, Inventory, Match or Cost Input side effects.
- Append-only Match and replay evidence.

### Security, Approval and Audit

- Purchase permissions are enforced at Application boundaries independently from UI visibility.
- Persisted Branch scope is rechecked for protected reads and writes.
- Approval and Confirmation remain distinct authorities.
- Inventory receipt staging, matching and cost resolution have dedicated permissions.
- Successful mutations emit shared Audit evidence with request/operation traceability.

### Persian RTL Desktop Workspace

- Persian RTL Purchase document workspace.
- Jalali business-date input with Gregorian durable storage.
- Supplier/Product/Service selectors.
- Purchase commercial line editor.
- Lifecycle and Approval actions.
- Inventory receipt staging.
- Receipt-cost resolution workflow.
- Stale-version recovery and explicit business errors.
- Compact shared display-density integration.

### Operational Reports

- Purchase Document Register.
- Supplier activity summary.
- Supplier Invoice / Inventory Receipt matching report.
- Unresolved Purchase-backed Inventory cost report.
- Company/Branch/Fiscal/date bounded queries.
- Reports are read-only rebuildable projections and never become synchronization or accounting authority.

### Argin Bridge

- Versioned sync envelopes for:
  - Purchase Document
  - Purchase Commercial Fact
  - Receipt/Invoice Match
  - Purchase Valuation Cost Input
- Durable Purchase and Inventory dependencies are preserved.
- Report rows, matching summaries, unresolved-cost projections and FIFO/MWA derived state are not synchronized as independent authoritative facts.
- Live network transport, acknowledgements and distributed conflict resolution remain Phase 45 scope.

### Quality

- Domain/Application regression matrix.
- Replay tests across Create, lifecycle, Inventory receipt staging, Match and Cost Resolution.
- Real SQLite migration, rollback, restart, constraint and concurrency tests.
- Concrete Desktop -> Purchase -> Inventory -> Valuation integration coverage.
- Bridge round-trip tests from persisted SQLite facts.
- Canonical `pnpm validate:phase22` release-quality gate.

## Intentionally Deferred

Phase 22 does not create supplier payable accounting, GRNI, VAT posting, Journal Vouchers or Posting Rules. Those belong to Phase 23 — Purchase Posting.

It also does not implement Sales commercial workflow, Treasury settlement, live Argin Bridge transport, or Iranian Taxpayer System submission.

## Release Dependency

Phase 22 is built directly on Phase 21 Inventory Valuation. `v0.22.0` must be tagged from a `main` commit that already contains the completed Phase 21 state.

## Next Phase

Phase 23 — Purchase Posting consumes confirmed Purchase commercial facts and Inventory Valuation outputs to create supplier payable, Inventory/GRNI and VAT accounting effects without duplicating Purchase price or Inventory cost authority.

## Publication

Semantic tag `v0.22.0` and the GitHub Release are manual repository-owner actions after the validated Phase 22 state is promoted through `develop` to `main`.
