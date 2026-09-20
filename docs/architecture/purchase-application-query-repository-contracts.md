# Purchase Application, Query and Repository Contracts

## Purpose

Step 13 freezes the persistence-neutral Application boundary for Purchase Workflow. Domain rules remain owned by `packages/purchase/src/domain`; Step 14 will orchestrate these rules through the contracts defined here.

## Operation Context

Every mutating Application command carries a durable `PurchaseOperationContext`:

- `companyId`
- `branchId`
- `requestId`
- `operationId`
- `actorUserId`
- normalized UTC `occurredAt`

`requestId` and `operationId` are carried now so Step 17 can apply replay/idempotency semantics without changing every command contract later.

## Command Surface

The command service exposes creation, lifecycle transitions, Inventory receipt staging, receipt/invoice matching and movement-cost resolution. Commands carry explicit expected version where optimistic concurrency is relevant; Step 17 owns final conflict/replay rules.

Step 13 does not implement command behavior. Step 14 owns orchestration and transaction boundaries.

## Query Surface

Queries are read-only and Company-scoped. `normalizePurchaseDocumentListQuery` standardizes optional Branch/Supplier/type/status/date filters and bounded pagination before repositories receive them.

No query mutates Domain or persistence state.

## Repositories

Purchase persistence is separated by authoritative fact type:

- `PurchaseDocumentRepository` owns Purchase aggregate snapshots.
- `PurchaseCommercialFactRepository` owns Purchase line commercial facts keyed by durable document/line IDs.
- `PurchaseReceiptInvoiceMatchRepository` owns immutable receipt/invoice match facts.
- `PurchaseValuationCostInputRepository` owns Purchase-backed valuation Cost Inputs and unresolved movement references.

The commercial-fact repository is intentionally separate because the current aggregate snapshot does not embed `PurchaseCommercialTerms`. Application code must resolve these facts from Purchase persistence; Inventory/Valuation must never ask the operator to re-enter them.

## Unit of Work

`PurchaseUnitOfWork` exposes the four Purchase repositories inside one persistence-neutral context. It defines atomic intent only; concrete SQLite transactions, rollback and locking are Step 16 concerns.

## Fiscal Ports

Step 13 formalizes two narrow Fiscal-facing ports required by Step 14:

- `PurchaseFiscalEligibilityPort` rechecks current Company/Branch/Fiscal period eligibility before mutation/confirmation.
- `PurchaseNumberReservationPort` reserves the Purchase display number through the authoritative Fiscal Number Series flow.

The frozen scope snapshot on the Purchase aggregate is historical evidence and cannot bypass current Fiscal locks.

## Inventory and Valuation Boundaries

Step 13 does not duplicate Inventory ports. Step 9 receipt staging and Steps 10–11 valuation/cost contracts remain the existing integration seams. Step 14 composes them with the Purchase UoW.

## Argin Bridge

The contracts use durable document, line, match, movement, request and operation identities. SQLite row IDs are not exposed. This allows the future Bridge adapter to map the same authoritative facts to PostgreSQL/.NET without redefining Purchase semantics.

Derived UI/report projections are outside repository authority and remain rebuildable.

## Deferred Work

- Step 14: concrete Application services and transaction orchestration.
- Step 15: schema, constraints and indexes.
- Step 16: SQLite repositories and Unit of Work.
- Step 17: idempotency, optimistic concurrency and replay conflict semantics.
- Step 18: formal Argin Bridge synchronization envelopes.
- Step 19: permission, approval and Audit integration.
