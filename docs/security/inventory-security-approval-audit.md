# Inventory Security, Approval, and Audit

## Status

Phase 20 Step 14 defines and implements the Inventory authorization boundary and integrates Inventory lifecycle actions with the shared Phase 8 Approval and Audit capabilities. Inventory does not create a second approval engine or audit store.

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

The injected `InventoryAuthorizationPolicy` is responsible for resolving the actor's Company membership and Branch access. Authorization failure maps to the stable `inventory.application.unauthorized` error before mutation.

Company-wide documents use `branchId = null`; the authorization adapter must interpret that scope explicitly rather than silently substituting the current Branch.

## Shared Approval Integration

`SharedInventoryApprovalGateway` is an adapter over `@argin/audit` Phase 8 Approval services.

One deterministic shared approval identity is used per Company + Inventory document:

`inventory-document:{companyId}:{documentId}`

The shared request uses:

- request type `inventory-document`;
- target entity type `inventory-document`;
- target entity ID = durable Inventory `documentId`;
- shared Company/Branch approval scope;
- shared Approval actor, history, permission and audit behavior.

Submission creates the shared request when absent and submits it. Repeated submit of a pending/approved request is replay-safe. Approval delegates to the shared approval transition. Confirmation calls `requireApproved()` before stock mutation; an absent, wrong-target, wrong-company or non-approved shared request blocks confirmation.

Inventory lifecycle status remains Inventory-owned. Shared Approval status remains Approval-owned. No Approval tables or state machines are duplicated in Inventory.

## Cross-Store Atomicity

Inventory stock writes use the Step 13 pinned SQLite transaction. Shared Approval/Audit have their own shared Unit of Work. Step 14 does not claim a distributed transaction across these modules.

The composition is retry-safe instead:

- deterministic approval request identity prevents duplicate logical approval requests;
- Inventory mutation idempotency prevents duplicate stock/lifecycle effects;
- deterministic Inventory audit entry identity prevents duplicate success audit records;
- confirmation refuses to run until shared approval is already `approved`.

If an infrastructure failure occurs between shared Approval and Inventory lifecycle persistence, retrying the same logical request converges without creating a second stock effect or second Approval request.

## Shared Audit Integration

`SharedInventoryAuditSink` maps Inventory success events to the shared Audit service.

Inventory records actor, Company, Branch, document identity, request/correlation identity, occurrence time, reason, before/after lifecycle status and operation metadata. Generic shared Audit actions are used (`submit`, `approve`, `cancel`, `status-change`, `import`, `export`), while the precise Inventory action is retained in metadata.

The audit entry ID is deterministic from:

`inventory:{inventoryAction}:{requestId}:{documentId}`

The adapter checks the shared Audit repository before recording, so a successful Application replay does not generate a second success audit record. `SecuredInventoryService` also suppresses audit emission when the inner Inventory mutation reports `replayed: true`.

## Phase Boundary

Step 14 does not implement:

- Warehouse/Zone/Location/Product dependency guards (Step 15);
- Inventory Desktop UI permission affordances (Step 16);
- import/export implementations (Step 18; permission codes are frozen now for those entry points);
- live Argin Bridge transport or remote authorization;
- accounting posting or valuation.

The Step 13 atomic stock transaction remains unchanged.
