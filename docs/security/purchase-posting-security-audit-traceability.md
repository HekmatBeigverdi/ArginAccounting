# Purchase Posting Permissions, Audit and Traceability

## Status

Phase 23 Step 23 secures the Purchase Posting Application boundary and freezes its Audit/Traceability contract.

Purchase Posting does not create a second Security, Approval or Audit subsystem.

## Permission Model

The following permissions are independently assignable under module `purchases`:

- `purchases.posting.view`
- `purchases.posting.execute`
- `purchases.posting.reverse`
- `purchases.posting.rules.manage`
- `purchases.posting.trace.view`

These permissions are registered in the core Security default-permission catalog.

## Accounting Lifecycle Boundary

`purchases.posting.execute` authorizes creation/preparation of the Purchase-origin Accounting Draft Journal.

It does **not** grant:

- Accounting Journal approval;
- Accounting Journal final posting;
- Accounting Journal reversal outside the controlled Purchase Posting flow.

Those rights remain owned by the Accounting permission namespace, including:

- `accounting.journal-vouchers.approve`
- `accounting.journal-vouchers.post`
- `accounting.journal-vouchers.reverse`

Phase 23 therefore does not bypass the canonical Accounting lifecycle.

## Persisted Company and Branch Scope

`SecuredPurchasePostingService` reloads the persisted Purchase Posting before Posting, Reversal, View and Trace operations.

Authorization is evaluated against the persisted:

- Company ID;
- Branch ID;
- Posting ID/state.

Caller-provided display/context scope cannot override persisted Posting scope.

This preserves the same security pattern already used by Phase 22 Purchase Workflow.

## Trace Integrity

The secured boundary consumes the existing Step 4 `PurchasePostingTraceContext`:

- requestId;
- operationId;
- correlationId;
- causationId.

For Posting creation, the trace must match the canonical Accounting Draft Journal source trace.

Mismatched request/correlation/causation values are rejected before authorization or persistence.

Reversal request identity must match the trace request ID.

## Shared Audit Contract

Successful secured operations emit `PurchasePostingAuditEvent`.

Audit events retain:

- Purchase Posting action;
- actor ID;
- Company and Branch;
- Posting ID;
- original Journal Voucher ID;
- Reversal Journal Voucher ID when present;
- request ID;
- operation ID;
- correlation ID;
- causation ID;
- occurrence time;
- Purchase source identity when applicable;
- before/after Posting status;
- before/after Posting version;
- reason;
- operation-specific durable metadata.

The deterministic Audit identity is:

```text
purchase-posting:{action}:{operationId}:{targetId}
```

where targetId is the Posting ID or Rule ID.

The shared Audit adapter is expected to use this identity for duplicate-safe append-only recording.

No Purchase Posting audit table is introduced.

## Audit Actions

Step 23 defines:

- `purchase-posting.prepare`
- `purchase-posting.replay`
- `purchase-posting.reverse`
- `purchase-posting.reversal-replay`
- `purchase-posting.rule.create`
- `purchase-posting.rule.update`
- `purchase-posting.trace.view`

Exact replay remains visible in Audit without causing duplicate accounting side effects.

## Posting Rule Security

Posting Rule mutation requires `purchases.posting.rules.manage`.

The secured boundary validates Company scope and Branch applicability before invoking the persistence mutation callback.

Audit preserves:

- Rule ID;
- Account role;
- Account ID;
- priority;
- active state;
- before/after Rule version.

## Trace Reader Contract

`PurchasePostingTraceReader` is the secured read boundary for future source-to-ledger trace views.

Its snapshot preserves:

```text
Purchase Source
  -> Purchase Posting
  -> Journal Voucher
  -> optional Reversal Journal
  -> request / operation / correlation / causation
  -> idempotency key
```

Step 23 freezes authorization and trace shape.

Step 24 owns Purchase-to-Ledger reconciliation/read models, and Step 25 owns the UI trace viewer.

## Argin Bridge

Bridge synchronization does not bypass local authorization.

Step 22 freezes transport-neutral identities. Step 23 defines who may initiate local Posting/Rule/Reversal operations and how successful local operations are audited.

Remote authorization/apply policy remains synchronization infrastructure scope.

## Tests

Focused tests cover:

- persisted Company/Branch authorization;
- execute permission enforcement;
- trace mismatch rejection before mutation;
- deterministic Audit identity;
- registration of all Purchase Posting permissions in the shared Security catalog.

## Non-Scope

- new Approval engine;
- new Audit persistence;
- role-management UI;
- remote Bridge authorization;
- reconciliation reader implementation — Step 24;
- Posting UI and Trace Viewer — Step 25.
