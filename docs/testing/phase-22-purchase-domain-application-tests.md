# Phase 22 — Purchase Domain and Application Test Matrix

## Scope

Phase 22 Step 22 strengthens executable coverage for the frozen Purchase Domain and Application behavior implemented in Steps 2–21.

This step does not own:

- real SQLite migration/integration validation;
- real Inventory/Valuation/Desktop cross-package integration;
- Argin Bridge end-to-end integration;
- monorepo build/release validation.

Those remain Steps 23–24.

## Domain Coverage

| Area | Primary test evidence |
| --- | --- |
| Purchase aggregate identity, scope, immutable snapshots and rehydration | `purchase-domain-model.test.ts` |
| Supplier/Product/Service commercial snapshots | `purchase-commercial-snapshots.test.ts` |
| exact quantity, units, money, discounts, charges and tax semantics | `purchase-commercial-semantics.test.ts` |
| deterministic pricing, sequential discounts, currency checks | `purchase-pricing-totals.test.ts` |
| lifecycle transitions and compensating terminal states | `purchase-lifecycle.test.ts` |
| Company/Branch/Fiscal scope and Number Series request | `purchase-scope-numbering.test.ts` |
| receipt/invoice line matching and over-allocation prevention | `purchase-receipt-invoice-matching.test.ts` |
| Inventory receipt intent boundary | `purchase-inventory-receipt-integration.test.ts` |
| Purchase-backed Cost Input and VAT exclusion | `purchase-inventory-valuation-cost-input.test.ts` |
| receipt-before-invoice unresolved/resolved policy | `purchase-receipt-before-invoice-policy.test.ts` |
| Return/Correction compensation plans | `purchase-return-correction-workflow.test.ts` |
| operational-report projections | `purchase-operational-reports.test.ts` |
| Bridge synchronization envelopes | `purchase-sync-contract.test.ts` |
| additional rounding/Correction/Return edge cases | `purchase-domain-edge-coverage.test.ts` |

### New Step 22 Domain edge coverage

`purchase-domain-edge-coverage.test.ts` adds:

- half-away-from-zero rounding for fractional quantity;
- half-away-from-zero percentage-tax rounding;
- quantity-increase Correction -> `inbound-follow-up`;
- deterministic de-duplication/order of affected movement IDs;
- commercial-only Correction with no Inventory/valuation side effect;
- invalid Correction direction rejection;
- exact decimal Return quantity preservation;
- duplicate compensation-line identity rejection.

## Application Coverage

| Area | Primary test evidence |
| --- | --- |
| persistence-neutral command/query/repository contracts | `purchase-application-contracts.test.ts` |
| create/edit/lifecycle/Fiscal/UoW/Inventory receipt orchestration | `purchase-application-service.test.ts` |
| request/operation/fingerprint replay safety | `purchase-replay-safety.test.ts` |
| permissions, Approval cycles and Audit | `purchase-security-integration.test.ts` |
| additional command/query/cost/matching boundaries | `purchase-application-boundary-coverage.test.ts` |
| secured query/Inventory-Matching-Cost permissions | `purchase-security-query-coverage.test.ts` |

### New Step 22 Application boundary coverage

`purchase-application-boundary-coverage.test.ts` adds:

- Create rejects Company mismatch before persistence.
- Create rejects Branch mismatch before persistence.
- Receipt staging rejects command/context fingerprint mismatch before Inventory side effect.
- Receipt/Invoice matching consumes the confirmed Inventory line and persists one durable Match.
- Missing confirmed receipt line fails before Match persistence.
- Full Movement cost coverage persists authoritative Cost Input.
- Valuation recalculation occurs only after Purchase Cost Input commit.
- Unmatched Movement remains unresolved and never triggers valuation recalculation.
- `getDocument`, normalized `listDocuments`, and receipt-cost preview are exercised as read paths.
- Cost preview remains non-mutating.
- Match replay returns the exact stored result without reading Inventory again or creating a second Match.
- Cost-resolution replay does not persist Cost Input twice or request valuation recalculation twice.

## Security and Query Coverage

`purchase-security-query-coverage.test.ts` adds:

- `getDocument` re-checks persisted Branch visibility when a returned document belongs to another Branch;
- `listDocuments` defaults an unspecified Branch to the operation Branch;
- receipt-cost query requires `purchases.documents.view`;
- Inventory staging uses `purchases.receipts.stage`;
- matching uses `purchases.matching.manage`;
- Cost resolution uses `purchases.cost-resolution.manage`;
- successful integration actions emit their dedicated Audit actions only after Application success.

## Replay Matrix

Step 22 now has explicit replay tests for all major Purchase mutation families:

| Mutation family | Replay evidence |
| --- | --- |
| Create | exact stored result; no second number reservation/write |
| Lifecycle | replay before stale-version validation |
| Inventory receipt staging | no second Inventory stage |
| Receipt/Invoice matching | no second Match and replay before re-reading receipt authority |
| Movement cost resolution | no second Cost Input write and no second valuation recalculation |

Changed payload under reused identity and operation/request rebinding remain conflict cases covered by `purchase-replay-safety.test.ts`.

## Test Isolation Rules

Domain tests use real Domain functions.

Application tests use in-memory contract implementations only for the external persistence/Inventory/Fiscal/Valuation boundaries. Assertions target observable Purchase behavior, ordering and durable outcomes rather than mock call counts alone.

No Step 22 test substitutes SQLite integration for Step 23.

## Verification Status

Direct package execution from this assistant environment is currently blocked because the container cannot resolve `github.com` to clone the repository.

Therefore Step 22 records authored test coverage and source-contract verification, but does not claim a fresh successful package test/typecheck run from this environment.

Authoritative local verification commands are:

```bash
pnpm --filter @argin/purchase test
pnpm --filter @argin/purchase typecheck
```

Step 23 will add/expand real SQLite, migration, Inventory, Valuation, Bridge and Desktop integration evidence.
