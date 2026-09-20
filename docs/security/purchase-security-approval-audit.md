# Purchase Security, Approval, Audit and Traceability

## Status

Phase 22 Step 19 secures the Purchase Application boundary and integrates Purchase lifecycle actions with the shared Phase 8 Approval and Audit capabilities.

Purchase does not create a second Approval engine or Audit store.

## Permission Model

Purchase permissions are independently assignable:

- `purchases.documents.view`
- `purchases.documents.create`
- `purchases.documents.edit`
- `purchases.documents.submit`
- `purchases.documents.approve`
- `purchases.documents.confirm`
- `purchases.documents.cancel`
- `purchases.documents.reopen`
- `purchases.documents.return`
- `purchases.documents.correct`
- `purchases.receipts.stage`
- `purchases.matching.manage`
- `purchases.cost-resolution.manage`
- `purchases.reports.export`

Approval and confirmation are deliberately separate rights. A user with Confirm permission cannot bypass shared Approval status.

The permission definitions are also registered in the core Security default-permission catalog under module `purchases`.

## Persisted Company/Branch Scope

`SecuredPurchaseService` reloads the persisted Purchase document before document-scoped mutations and authorizes against the real persisted Company and Branch.

Caller-provided Branch display/context does not override persisted Branch authority.

Create authorization uses the requested document scope because the aggregate does not exist yet.

Receipt staging and matching authorize against the persisted Purchase document that owns the commercial intent/invoice side.

Cost-resolution operations remain explicitly permission-gated by Company/Branch context and retain movement/cost IDs in Audit metadata.

## Submission Approval Cycle

A Purchase document can be reopened from Approved back to Draft and later resubmitted.

Therefore one Approval request per document for all time would be unsafe: an old Approval could accidentally authorize amended content.

Purchase defines one Approval cycle per successful Submit transition.

The cycle key is the `occurredAt` of the latest lifecycle transition whose `toStatus` is `submitted`.

Shared Approval identity is deterministic:

`purchase-document:{companyId}:{documentId}:{approvalCycleKey}`

Consequences:

- exact replay of one Submit reuses/repairs the same Approval request;
- reopening and resubmitting creates a new cycle key and therefore a new Approval request;
- old Approved requests remain historical evidence and cannot authorize a later amended submission.

## Shared Approval Integration

`SharedPurchaseApprovalGateway` adapts `@argin/audit` Approval services.

Submit ordering:

1. authorize;
2. execute/replay Purchase Submit;
3. create or repair the deterministic shared Approval request for that submission cycle;
4. record success Audit.

If Purchase Submit committed but shared Approval failed, replay of the same Purchase mutation is safe because Step 17 returns the original Purchase result and Approval composition is retried.

Approve ordering:

1. authorize against persisted submitted Purchase document;
2. resolve the latest submission cycle;
3. approve the shared Approval request;
4. execute/replay Purchase Approve;
5. record success Audit.

If shared Approval commits before Purchase Approve and Purchase subsequently fails, retry observes the already Approved shared request and may safely retry the Purchase idempotent mutation.

Confirm ordering:

1. authorize;
2. resolve latest submission cycle;
3. require that exact shared Approval request to be Approved;
4. execute/replay Purchase Confirm;
5. record success Audit.

No Approval from an older submission cycle is accepted.

## Return and Correction

Purchase Return and Purchase Correction are explicit document permissions.

The terminal transition on the original document references a separately confirmed compensating Purchase document. That compensating document has already followed its own Submit/Approval/Confirm lifecycle.

Return/Correction never mutate historical source facts in place and Audit retains the related compensating document ID.

## Shared Audit Integration

`SharedPurchaseAuditSink` maps Purchase success events to shared Audit.

Each event retains:

- exact Purchase action;
- actor;
- Company and Branch;
- durable Purchase document identity when applicable;
- request ID;
- operation ID;
- correlation ID;
- occurred-at timestamp;
- before/after Purchase status;
- reason;
- aggregate version and operation-specific durable references.

The deterministic Audit identity is:

`purchase:{purchaseAction}:{operationId}:{targetId}`

This aligns Audit traceability with Step 17 replay identity. Replaying a successful mutation does not create duplicate Audit history because the shared adapter checks the deterministic identity before insert.

## Traceability Across Modules

Examples:

### Inventory receipt staging

Audit retains:

- Purchase document ID;
- Purchase operation/request identity;
- generated Inventory document ID;
- Inventory status/version.

### Receipt/Invoice matching

Audit retains:

- Purchase invoice document/line;
- Match ID;
- Inventory receipt document/line.

### Cost resolution

Audit retains:

- movement ID;
- Cost Input ID;
- resolved/unresolved status and reason;
- Purchase request/operation identity.

This preserves traceability without transferring ownership between bounded contexts.

## Argin Bridge Interaction

Bridge synchronization does not bypass local Authorization or Approval.

Step 18 envelopes retain durable identities and replay metadata, while Step 19 defines who may initiate Purchase mutations locally and how successful mutations are audited.

Remote authorization/apply policy remains infrastructure/synchronization scope rather than Purchase Domain authority.

## Deferred Scope

Step 19 does not implement:

- Purchase Desktop screens;
- role-management UI;
- report/export UI;
- remote authorization;
- posting permissions for Phase 23 Accounting;
- a new Approval or Audit database.

Those remain in their owning steps/phases.
