# Phase 22 — Purchase SQLite and Cross-Module Integration Tests

## Scope

Phase 22 Step 23 validates the frozen Purchase workflow against real SQLite persistence and the concrete Desktop/Inventory/Valuation/Bridge composition.

This step owns integration evidence for:

- migrations 30–32 on real SQLite;
- Purchase SQLite repositories and Unit of Work;
- optimistic concurrency and replay persistence;
- Purchase -> Inventory receipt staging;
- Purchase -> Inventory Valuation Cost Input delivery;
- receipt/invoice Match persistence;
- Purchase Bridge envelopes built from persisted facts;
- Desktop Purchase composition.

It does not own the final monorepo/release gate. That remains Step 24.

## Real SQLite Migration Evidence

`purchase-step23-sqlite-bridge-integration.test.ts` uses Node's real `node:sqlite` engine and applies the actual Desktop migration files.

The upgrade scenario:

1. applies migrations through Phase 21 / version 29;
2. persists pre-existing master data;
3. applies Purchase migrations 30, 31 and 32;
4. verifies pre-existing data survives;
5. verifies Purchase tables exist;
6. verifies the historical Fiscal scope snapshot columns from migration 31;
7. verifies `purchase_idempotency.result_json` from migration 32.

This is runtime SQLite evidence rather than text-only migration inspection.

## Real Purchase Unit of Work

The same integration suite executes `SqlitePurchaseUnitOfWork` against real SQLite.

A forced Commercial Fact insert failure occurs after the Purchase document and line writes inside the transaction.

The assertion verifies rollback of:

- `purchase_documents`;
- `purchase_document_lines`;
- `purchase_commercial_facts`.

This demonstrates that aggregate and commercial authority do not partially commit.

## Restart and Replay Durability

A file-backed SQLite database is created, migrated and populated with:

- Purchase aggregate;
- Commercial Fact;
- Purchase Idempotency result.

The connection is closed and a new connection reopens the same file.

After restart the test rehydrates:

- document number;
- full historical Fiscal scope snapshot;
- Product snapshot;
- exact idempotency operation/result JSON.

A changed payload under the same persisted replay identity is rejected.

## Real SQLite Constraint Evidence

The integration suite verifies runtime enforcement for:

- scoped Purchase document-number uniqueness;
- append-only receipt/invoice Match facts;
- append-only Purchase Idempotency evidence;
- optimistic-concurrency stale-version rejection through the concrete repository.

These are exercised against SQLite triggers/indexes rather than source regex alone.

## Desktop -> Purchase -> Inventory

`purchase-create-integration.test.ts` provides the concrete Desktop workflow integration.

The suite uses the real Desktop Purchase composition and all actual migrations in an in-memory SQLite database.

Covered flows include:

- numbered Supplier Invoice creation and reload;
- transactional draft editing;
- stale edit rejection;
- permission enforcement;
- snapshot preservation when current Product tax master data changes;
- Persian numeric input conversion;
- rollback of failed Purchase persistence and Number Series reservation;
- Purchase receipt-draft staging through Inventory Application services;
- reuse of an already linked Inventory receipt;
- confirmed receipt lookup from Purchase detail;
- duplicate Inventory source-document protection.

Purchase does not directly write Inventory stock movements through its receipt-staging boundary.

## Receipt/Invoice Matching and Valuation

The Desktop integration suite also covers a confirmed Supplier Invoice plus confirmed Inventory receipt and movement.

It verifies:

- unresolved cost visibility before matching;
- durable receipt/invoice Match creation;
- no duplicate Match under replay;
- Purchase Cost Input persistence;
- delivery into `inventory_valuation_cost_inputs`;
- matching/report visibility after resolution;
- permission checks before creating Match/Cost facts;
- refusal to overwrite an existing manual Inventory Cost Input;
- failed cost delivery remains observable and is retryable;
- retry does not duplicate the Match;
- reversed, wrong-Branch, missing-source and wrong-Product receipts do not create Cost Input;
- Purchase Order receipt remains unresolved until Supplier Invoice authority exists;
- partial Match remains partial and is not silently expanded;
- Inventory consumes the Purchase source cost without advancing revision on replay;
- cost resolution uses persisted Purchase Branch scope rather than caller-supplied scope.

## Bridge from Persisted Facts

The new real-SQLite integration suite persists and re-reads:

- Purchase Document;
- Purchase Commercial Fact;
- Receipt/Invoice Match;
- Purchase Valuation Cost Input.

The rehydrated facts are passed to the Phase 22 Bridge contract builders:

- `createPurchaseDocumentSyncUpsertEnvelope`;
- `createPurchaseCommercialFactSyncEnvelope`;
- `createPurchaseReceiptInvoiceMatchSyncEnvelope`;
- `createPurchaseValuationCostInputSyncEnvelope`.

The envelopes survive JSON round-trip without fact drift.

The persisted Cost Input envelope retains dependencies on:

- Inventory Movement;
- Inventory Document;
- Inventory Line;
- Product;
- Warehouse;
- Purchase Match;
- Purchase Document;
- Purchase Line.

Report/projection state remains excluded from synchronization authority.

## Existing Supporting Integration Evidence

Step 23 also relies on existing concrete integration suites owned by upstream modules:

- `packages/inventory-tauri/tests/inventory-inbound-cost-sqlite-integration.test.ts`;
- `packages/inventory-tauri/tests/inventory-valuation-bridge-performance.test.ts`;
- `packages/inventory-tauri/tests/inventory-valuation-persistence.test.ts`;
- `apps/desktop/tests/phase20-desktop-integration-contract.test.ts`.

These remain upstream authority; Purchase does not duplicate their internals.

## Verification Boundary

The Step 23 source/integration matrix is complete in the branch.

Fresh execution of the full workspace test commands is not claimed unless command output is observed.

Authoritative local verification commands:

```bash
pnpm --filter @argin/purchase test
pnpm --filter @argin/purchase typecheck

pnpm --filter @argin/purchase-tauri test
pnpm --filter @argin/purchase-tauri typecheck

pnpm --filter @argin/inventory test
pnpm --filter @argin/inventory-tauri test

pnpm --filter @argin/desktop test
pnpm --filter @argin/desktop typecheck
```

Step 24 owns final monorepo validation, documentation reconciliation and release.
