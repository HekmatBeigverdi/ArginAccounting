# Purchase Application Services and Transaction Boundaries

## Purpose

Step 14 turns the persistence-neutral contracts from Step 13 into the first concrete Purchase application orchestration layer while preserving bounded-context ownership.

Purchase Application Services coordinate Domain rules, Purchase repositories, Fiscal policy, Inventory receipt staging and Inventory Valuation recalculation. They do not implement SQLite, accounting posting, live Bridge transport, or final replay/concurrency semantics.

## Service Boundary

`createPurchaseApplicationServices` exposes two services:

- `commands`: mutation/orchestration operations;
- `queries`: read-only Purchase application queries.

Every mutating command carries `PurchaseOperationContext` with Company, Branch, request, operation, actor and timestamp identity.

## Create Transaction

Purchase creation executes inside `PurchaseUnitOfWork.execute` and follows this order:

1. normalize the operation context;
2. require Company/Branch agreement with the new Purchase document;
3. re-check current Fiscal eligibility through `PurchaseFiscalEligibilityPort`;
4. reserve a Purchase document number through `PurchaseNumberReservationPort` when the caller did not already provide one;
5. create the Purchase Domain aggregate;
6. derive immutable line commercial facts from `commercialTermsByLine`;
7. persist the document and its commercial facts inside the Purchase UoW.

Commercial facts are never re-entered by Inventory or Valuation later. The Application layer resolves them from the Purchase-owned repository.

## Lifecycle Transactions

Submit, approve, confirm, cancel and reopen all:

- load the document inside the Purchase UoW;
- validate Company/Branch scope;
- enforce `expectedVersion` before mutation;
- re-check current Fiscal eligibility instead of trusting only the captured historical scope;
- invoke the existing Domain lifecycle transition;
- persist with the same expected version.

Step 14 performs the early optimistic-version guard, while Step 17 freezes final replay and concurrency-conflict semantics.

`returnPurchase` and `correct` are explicit terminal transitions on the original confirmed supplier invoice. The related document must already exist, be confirmed, have the expected compensating type, and point back to the original through its correction reference. Merely confirming a partial return document does not automatically invoke the terminal `returned` transition.

## Inventory Receipt Boundary

`stageInventoryReceipt` first reads the confirmed Purchase document and Purchase-owned commercial facts in a Purchase read transaction. It then leaves the Purchase UoW and calls the Inventory-owned staging port.

This ordering is deliberate:

- Purchase does not write Inventory movements;
- Inventory remains authoritative for its own document lifecycle;
- an external Inventory side effect is not executed before an unfinished Purchase write transaction commits.

The request uses the Purchase operation `requestId` as the staging request key and keeps the caller-provided payload fingerprint. Final replay behavior belongs to Step 17.

## Receipt/Invoice Matching Boundary

Application matching does not trust an arbitrary persisted-looking match snapshot. It resolves:

- the supplier invoice and Purchase commercial fact from Purchase repositories;
- the confirmed receipt line from an Inventory-owned reader port;
- existing matches on both invoice and receipt sides.

It then calls the Step 8 Domain matcher and only persists the validated match result.

## Cost Resolution and Recalculation Boundary

`resolveMovementCost` reads the authoritative Inventory movement through a dedicated Inventory reader port. Inside the Purchase UoW it then:

1. loads receipt/invoice matches;
2. resolves the corresponding confirmed supplier invoices and Purchase commercial facts;
3. evaluates Step 11 receipt-before-invoice cost resolution;
4. persists a newly resolved Cost Input, or replaces the active Purchase-backed Cost Input for the movement.

Only after the Purchase UoW commits does Application call the valuation recalculation port with `cost_basis_changed` semantics. This prevents Valuation from replaying against a Cost Input that has not committed yet.

Unresolved decisions do not silently persist zero cost and do not trigger a false resolved-cost recalculation.

## Query Boundary

The query service exposes document lookup/listing and movement cost-decision inspection. Document list filters are normalized by Step 13 contracts.

Cost-decision queries are read-only. If a resolved preview has no persisted Cost Input yet, an internal `preview:<movementId>` identity is used only to construct the deterministic preview result; it is never persisted as an authoritative Cost Input ID.

## Argin Bridge Considerations

The Application layer preserves durable business identities:

- Company and Branch;
- Purchase document and line IDs;
- Inventory document, line and movement IDs;
- match and Cost Input IDs;
- request and operation IDs.

No orchestration contract depends on SQLite row identity. The same boundaries can therefore be adapted later to PostgreSQL/.NET and Argin Bridge transport without changing Domain semantics.

## Deferred Scope

Step 14 intentionally does not implement:

- SQL schema, migrations, indexes or constraints (Step 15);
- concrete SQLite repositories/UoW and rollback behavior (Step 16);
- final idempotency replay, fingerprint conflict and optimistic-concurrency semantics (Step 17);
- Bridge sync envelope/transport rules (Step 18);
- authorization/audit implementation (Step 19);
- accounting posting (Phase 23).
