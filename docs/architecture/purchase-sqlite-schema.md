# Purchase Workflow SQLite Schema and Persistence Boundary

Phase 22 Step 15 introduces migration `0030_purchase_workflow.sql`. The migration is additive and establishes the durable SQLite schema required by the Purchase Domain/Application contracts completed through Step 14. Concrete repository SQL and transaction implementation remain Step 16.

## Migration Registration

The Desktop migration runner registers:

- version: `30`
- description: `purchase_workflow`
- file: `apps/desktop/src-tauri/migrations/0030_purchase_workflow.sql`

No existing Purchase data transformation is required because Phase 22 did not previously have durable Purchase tables.

## Tables

### `purchase_documents`

Durable Purchase aggregate header. It persists Company/Branch/Fiscal scope, Supplier identity and immutable Supplier snapshot JSON, document type/status/number/date, source reference, optional correction reference, optimistic `version`, timestamps and Bridge-ready synchronization metadata.

Document number uniqueness is scoped by Company + Fiscal Year + Branch + Purchase document type.

### `purchase_document_lines`

Stable line identity and ordering under one Purchase document. It stores line classification, durable Product/Service identity, immutable item snapshot JSON, description and optional source reference.

The table does not own commercial pricing. Commercial terms remain a separate Purchase-owned fact.

### `purchase_document_lifecycle`

Append-only lifecycle transition history. UPDATE and DELETE are rejected by triggers. Terminal `returned` and `corrected` transitions require a related Purchase document identity and reason.

### `purchase_commercial_facts`

Current authoritative Purchase commercial fact per document line. The complete `PurchaseCommercialTerms` snapshot is retained as JSON and the persistence boundary also stores canonical entered/base quantities, unit identities, safe-integer unit price, ISO currency, tax treatment/rate and revision for validation and efficient reconstruction.

This table is the persistence source consumed by Step 14. Inventory and Valuation must not ask the operator to re-enter Purchase quantity or commercial price.

### `purchase_receipt_invoice_matches`

Append-only durable invoice-line to confirmed Inventory receipt-line allocation. It preserves Company/Product identities and canonical matched base quantity. The same invoice-line/receipt-line pair is unique, matching the Step 8 Domain invariant.

UPDATE and DELETE are rejected by triggers.

### `purchase_valuation_cost_inputs`

Purchase provenance for resolved inbound valuation cost. Each Inventory movement has at most one current Purchase Cost Input. The row retains receipt line, Product/Warehouse, quantity, currency, safe-integer costs, unit cost, source provenance JSON and complete valuation-basis JSON.

The referenced Inventory movement remains Inventory-owned and valuation calculation remains Phase 21-owned.

### `purchase_idempotency`

Durable storage reserved for Step 17 replay semantics. Company + request ID is the primary request identity and Company + operation ID is independently unique. Payload fingerprint and durable outcome identity are stored in the same schema now so Step 17 does not require an incompatible schema rewrite.

Step 15 defines storage and constraints only; Step 17 remains authoritative for replay/conflict behavior.

## Integrity Boundaries

SQLite enforces:

- same-Company Purchase document/Branch/Supplier relationships;
- Product/Service line ownership;
- document and line classifications;
- positive versions/revisions;
- safe-integer commercial and cost amounts;
- ISO-style three-letter uppercase currency storage;
- Company/Fiscal/Branch/type scoped document-number uniqueness;
- unique receipt/invoice match pairs;
- one current Purchase Cost Input per Inventory movement;
- durable request and operation identity uniqueness;
- append-only lifecycle and match facts.

Cross-row rules that require current business state remain Application responsibilities, including current Fiscal locks, cumulative return coverage, cumulative quantity over-match validation, Supplier role eligibility, current Product/Warehouse eligibility and full idempotency fingerprint semantics.

## Index Policy

Indexes cover:

- bounded document lists by status/date;
- Supplier/date, type/date and Branch/date filters;
- Fiscal scope;
- correction-chain lookup;
- document-line and Product access;
- commercial-fact lookup;
- invoice-line and receipt-line matching;
- movement/receipt/Product Cost Input lookup;
- idempotency operation/outcome diagnostics;
- Bridge incremental-change scans on authoritative Purchase facts.

## Argin Bridge Compatibility

All authoritative Purchase tables use durable business identities rather than SQLite row IDs. Documents, commercial facts, matches and Cost Inputs reserve `sync_origin`, nullable `server_revision` and `sync_changed_at` where they are synchronization facts.

Step 18 owns the synchronization envelope and conflict contract. Step 15 only ensures the persistence shape can support it.

## Compatibility and Recovery

The migration is additive. Existing Inventory/Valuation tables are referenced through foreign keys but are not altered. Recovery from a migration failure is transaction rollback/retry from the previous schema version; released migration files remain immutable after release.

Formal empty-database, upgrade, rollback, restart and real repository integration validation remains Step 23/24.

## Step 15 Verification

Focused verification executed during Step 15:

- migration-contract test: 5 passed, 0 failed;
- SQLite schema execution against dependency-compatible stubs: passed;
- checked document-number uniqueness;
- checked append-only lifecycle trigger;
- checked duplicate receipt/invoice match rejection;
- checked one-cost-input-per-movement storage;
- checked request/operation identity uniqueness.

This evidence does not claim the Step 16 SQLite repository implementation or full monorepo validation.
