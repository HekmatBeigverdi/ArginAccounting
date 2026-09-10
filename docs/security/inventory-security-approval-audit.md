# Inventory Security, Approval, and Audit

## Status

Phase 20 implements the Inventory authorization boundary and integrates lifecycle actions with the shared Phase 8 Approval and Audit capabilities. Inventory does not create a second approval engine or audit store. Later Desktop/import/reporting integrations consume the same permission model; Step 21 reconciles this record with the completed module surface.

## Permissions

Inventory permissions are independently assignable:

- `inventory.documents.view`
- `inventory.documents.create`
- `inventory.documents.edit`
- `inventory.documents.submit`
- `inventory.documents.approve`
- `inventory.documents.confirm`
- `inventory.documents.reverse`
- `inventory.documents.cancel`
- `inventory.documents.import`
- `inventory.documents.export`

Approval and confirmation are deliberately separate permissions. A user allowed to approve a document does not automatically receive the right to affect stock, and a user allowed to confirm does not bypass shared Approval state.

## Company and Branch Enforcement

`SecuredInventoryService` reloads the persisted Inventory document before a lifecycle mutation and evaluates authorization using the document's real `companyId` and origin `branchId`. Caller-supplied display values are not trusted as scope authority.

The injected `InventoryAuthorizationPolicy` resolves Company membership and Branch access. Authorization failure maps to `inventory.application.unauthorized` before mutation. Company-wide documents use `branchId = null`; adapters must interpret that scope explicitly rather than silently substituting the active Branch.

Quantity reports apply the same principle. Company-wide aggregate stock is exposed only to company-wide/full-access actors; Branch-scoped users receive only company-wide Warehouses plus Warehouses visible to their active Branch. Source drill-down cannot expose a document outside the actor's permitted scope.

## Shared Approval Integration

`SharedInventoryApprovalGateway` adapts `@argin/audit` Phase 8 Approval services.

One deterministic shared approval identity is used per Company + Inventory document:

`inventory-document:{companyId}:{documentId}`

The shared request uses request type and target type `inventory-document`, durable Inventory `documentId`, shared Company/Branch scope and shared Approval history/authorization. Submission creates/submits the request when absent and is replay-safe for existing pending/approved requests. Confirmation calls `requireApproved()` before stock mutation; absent, wrong-target, wrong-company or non-approved requests block confirmation.

Inventory lifecycle status remains Inventory-owned. Shared Approval status remains Approval-owned.

## Cross-Store Atomicity and Retry Safety

Inventory stock writes use the pinned SQLite transaction. Shared Approval/Audit have their own shared Unit of Work; Phase 20 does not claim a distributed transaction across modules.

Composition converges safely through deterministic identities and retries:

- deterministic Approval identity prevents duplicate logical approval requests;
- Inventory idempotency prevents duplicate lifecycle/stock effects;
- submit replay re-enters Approval composition so a prior Inventory submit followed by Approval failure can heal;
- deterministic Audit identity prevents duplicate success records;
- confirmation refuses to run until shared Approval is already approved.

## Shared Audit Integration

`SharedInventoryAuditSink` maps Inventory success events to shared Audit.

Events retain actor, Company, Branch, durable document identity, request/correlation identity, occurrence time, reason, before/after status and operation metadata. Generic shared actions are used while the exact Inventory action remains in metadata.

The deterministic Audit identity is:

`inventory:{inventoryAction}:{requestId}:{documentId}`

Application replay suppresses duplicate success events and the shared adapter checks the existing deterministic audit identity before recording.

## Import, Export and Reporting

Import requires `inventory.documents.import`; it validates and persists Draft documents only and never silently submits, approves or confirms. Export/print/report surfaces require the relevant view/export permissions and do not mutate stock. Imported Drafts subsequently follow the same secured lifecycle as manually created documents.

## Master-Data Protection

Warehouse/Zone/Location operations remain Warehouse-owned. Desktop composition registers the Inventory implementation of the Warehouse dependency port. This keeps dependency direction intact while allowing Inventory stock/open-document/history facts to block unsafe delete/deactivate/archive/move operations according to the Phase 20 guard policy.

## Argin Bridge Boundary

Bridge envelopes carry durable Company/document/line/movement/transfer/reversal identities and idempotency metadata. Remote transport does not weaken local authorization rules, confirmed movements are never last-write-wins mutable records, and derived stock balances are not synchronized as independent authoritative facts.

## Deferred Security Scope

Phase 20 does not implement live remote authorization, Bridge transport/acknowledgement, accounting posting, valuation authorization, reservation/ATP rules, lot/serial controls or two-stage logistics. Those capabilities require their owning later phases.
