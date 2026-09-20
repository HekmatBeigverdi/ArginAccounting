# Inventory Valuation Permissions, Audit and Traceability

Phase 21 Step 15 protects privileged monetary valuation operations and makes valuation results explainable without moving report/UI ownership ahead of Steps 16–17.

## Permission Catalog

`inventoryValuationPermissions` defines independent capabilities:

- `inventory.valuation.view` — inspect valuation data and traceability.
- `inventory.valuation.policy.manage` — create/transition Company valuation policy.
- `inventory.valuation.cost-input.correct` — correct authoritative resolved monetary input.
- `inventory.valuation.recalculate` — initiate deterministic downstream rebuild.
- `inventory.valuation.resolve` — resolve/re-resolve monetary valuation facts.
- `inventory.valuation.export` — export valuation information.

Viewing does not imply mutation rights. Policy governance, cost-input correction and recalculation are deliberately separate permissions.

## Authorization Boundary

`InventoryValuationAuthorizationPolicy` is persistence-neutral and receives actor, Company, request and correlation identity. Application services must require the operation-specific permission before entering a guarded mutation.

Authorization does not replace Step 13 idempotency/concurrency. A permitted mutation still executes through the same request replay, stream CAS and transaction boundary.

## Audit Actions

Append-only audit actions are defined for:

- initial policy setup,
- policy transition,
- cost-input correction,
- movement valuation resolution,
- recalculation,
- export.

`InventoryValuationAuditEvent` carries actor, Company, request/correlation identity, target, reason, before/after snapshots and bounded metadata.

`SharedInventoryValuationAuditSink` adapts those events to the shared Phase 8 Audit engine. Its deterministic identity is based on action + requestId + target, so a successful idempotent replay does not create a second audit fact.

## Before/After Semantics

Policy transition and cost-input correction should record both old and new authoritative snapshots. Recalculation records the affected stream/boundary and summary metadata rather than serializing every rebuilt projection into one audit row. Detailed result lineage is supplied through traceability and Step 16 queries.

## Traceability

`createInventoryValuationTraceSnapshot()` builds a persistence-neutral provenance chain for one movement. Supported nodes include:

- Phase 20 movement,
- resolved cost input,
- effective valuation policy,
- valuation entry,
- cost layer,
- recalculation.

Current Step 15 links establish the essential path:

`Movement -> Cost Input -> Valuation Entry`

and:

`Policy -> Valuation Entry`

The builder rejects Company/Product/Movement mismatches so a UI/report cannot silently display provenance from another stream.

## Unresolved Cost

Traceability also works when monetary cost is unresolved. An unresolved entry still retains effective Policy and movement provenance while `unitCost`/`totalCost` remain null. Missing cost must never be displayed as zero merely to complete a trace.

## Argin Bridge

Audit facts are operational evidence, while Phase 14 authoritative valuation sync remains limited to Policy history and resolved Cost Inputs plus Phase 20 movements. Derived trace graphs are rebuilt from durable IDs and are not authoritative Bridge payloads.

Future server-side audit may use the same action/request/target identities. Live audit replication and distributed retention policy remain outside Phase 21.

## Deferred Ownership

Step 16 owns bounded valuation query/report implementations. Step 17 owns Persian RTL drill-down UI. Steps 18–19 own broader executable and real-SQLite validation.
