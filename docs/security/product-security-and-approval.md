# Product and Service Security, Audit, and Approval Boundary

## Scope

This document defines the Phase 18 security boundary for Product and Service Master Data.

## Authorization

Product and Service authorization is enforced at the Application boundary, not only in React or desktop routing.

The canonical permissions are:

- `master-data.products.view`
- `master-data.products.create`
- `master-data.products.update`
- `master-data.products.manage-identifiers`
- `master-data.products.manage-units`
- `master-data.products.manage-master-data`
- `master-data.products.change-status`
- `master-data.products.import`
- `master-data.products.export`
- `master-data.products.manage-taxpayer-reference-data`

All authorization requests carry actor, company, correlation, and request identity. Company scope comes from the command/query boundary and must never be inferred from a Product code or title.

## Audit

Successful Product/Service mutations emit append-only audit facts through `ProductAuditSink` after the underlying Application mutation succeeds.

Audit facts include:

- action
- actor id
- company id
- durable Product id
- correlation id
- request id
- Gregorian occurrence time
- bounded mutation metadata

The audit sink must be idempotent for the same `(action, requestId, productId)` tuple so an idempotent Product request replay cannot create duplicate audit facts. Audit records must never contain inventory balances, document state, secrets, or unrestricted object snapshots.

A lifecycle request that resolves to an Application no-op is not recorded as a new mutation audit fact.

## Approval Evaluation

Phase 18 does **not** introduce a Product/Service approval workflow.

Rationale:

- Product and Service Master Data CRUD does not currently have a defined business state machine requiring submit/approve/reject semantics.
- The existing Approval subsystem remains authoritative for workflows that have a justified approval lifecycle.
- Adding approval merely because the shared platform supports it would create artificial states, permissions, and operational complexity with no approved business requirement.
- Future Purchase, Sales, Inventory, Taxpayer, or governance requirements may reference Product Master Data, but they must not retroactively turn ordinary Product maintenance into an implicit approval request.

If a future requirement introduces controlled approval for Product changes, it must be an explicit Change Request or later-phase feature and must reuse the shared Approval subsystem rather than creating a Product-specific approval engine.

## Boundary Rules

- Authorization precedes mutation execution.
- Failed authorization must not call the inner Product service and must not emit a success audit event.
- Audit is append-only and does not replace optimistic concurrency or idempotency.
- Business validation remains in Domain/Application.
- SQLite constraints remain a persistence safety net, not the authorization source of truth.
- React/UI may hide unavailable actions for usability, but UI visibility never replaces Application authorization.
