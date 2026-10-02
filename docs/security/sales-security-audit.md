# Sales Security, Audit and Traceability

Phase 24 Step 26 integrates Sales with the project's shared authorization/audit boundary without making Sales the owner of users, roles or audit storage.

## Permission namespace

Sales exposes stable permission keys for document view/create/edit, lifecycle submit/approve/reject/finalize/cancel, Inventory issue/return-receipt staging and report export.

Authorization is Company + Branch scoped. A caller must be authorized before the mutation callback executes.

## Audit trace

Every successful secured Sales mutation can be traced by:

```text
actorId
  -> correlationId
  -> requestId
  -> operationId
  -> payloadFingerprint
  -> Sales documentId
  -> beforeVersion / afterVersion
  -> beforeStatus / afterStatus
```

The mutation operation name and payload fingerprint are retained in Audit metadata, matching the identities used by replay safety and Argin Bridge envelopes.

Authorization failure produces no successful-mutation Audit event and does not execute the mutation.

## Scope protection

The secured mutation boundary verifies that the preloaded aggregate and returned aggregate remain inside the authorized Company, Branch and target document identity. An application adapter cannot authorize one scope and return a mutation from another.

## Ownership

- shared Security owns users, roles and permission assignment;
- shared Audit owns append-only Audit persistence and de-duplication;
- Sales owns the permission vocabulary and Sales-specific audit facts;
- Inventory authorization remains required by Inventory for its own Issue/Receipt operations;
- Bridge synchronization never bypasses local authorization.

Approval workflow orchestration is not duplicated here: Sales Step 17 defines approval-capable lifecycle states, while shared Approval integration can be composed by the application layer without changing Sales document authority.
