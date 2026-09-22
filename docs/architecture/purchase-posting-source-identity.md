# Purchase Posting Source Identity and Reference Contracts

## Status

Phase 23 Step 4.

This document freezes durable source identity and trace-reference contracts used by Purchase Posting. It does not implement posting eligibility, idempotency decisions, persistence, or the final Argin Bridge envelope.

## Separation of Concerns

Source identity and execution tracing are deliberately separate:

```text
PurchasePostingSourceIdentity
        ≠
PurchasePostingTraceContext
```

A source identity answers:

> Which exact authoritative Purchase fact/version is being recognized?

A trace context answers:

> Which request/operation caused this recognition and how does it relate to the wider workflow?

This separation prevents retry/request metadata from becoming business identity.

## Source Identity

`PurchasePostingSourceIdentity` contains:

- `companyId`;
- `branchId`;
- `sourceSystem = "purchase"`;
- `sourceType`;
- `sourceId`;
- `sourceVersion`;
- optional `sourceRevision`.

For Phase 23, `sourceType` uses the frozen Purchase document vocabulary:

- `purchase-order`;
- `supplier-invoice`;
- `purchase-return`;
- `purchase-correction`.

`sourceVersion` represents the authoritative Purchase aggregate version captured by Step 3.

`sourceRevision` is an explicit optional second axis for future source schemas/workflows where a business revision must be represented independently of aggregate concurrency version. A null revision means the upstream source currently exposes no separate revision.

## Fact Matching

A Source Identity matches a Purchase Posting Fact only when all of the following agree:

```text
companyId
branchId
sourceType       == fact.documentType
sourceId         == fact.purchaseDocumentId
sourceVersion    == fact.purchaseDocumentVersion
```

This prevents accounting from silently posting a stale or cross-scope Purchase snapshot.

## Line Reference

`PurchasePostingSourceLineReference` combines the durable document Source Identity with a `sourceLineId`.

The line ID must exist in the immutable Step 3 Fact. It does not depend on array index, UI row position or SQLite row ID.

## Trace Context

`PurchasePostingTraceContext` contains:

- `requestId` — identity of the caller/request boundary;
- `operationId` — identity of this concrete posting operation;
- `correlationId` — groups the wider business/workflow chain;
- `causationId` — identifies the prior operation/event that caused this operation, or null for a root operation.

A causation ID cannot equal the current operation ID.

Correlation and causation are trace semantics only. They do not replace durable Source Identity.

## Canonical Source Identity Key

Step 4 exposes a deterministic textual key:

```text
purchase:{company}:{branch}:{sourceType}:{sourceId}:v{sourceVersion}:r{sourceRevision|-}
```

This is a canonical lookup/reference representation only. String components are URI-escaped before joining so delimiter-bearing IDs cannot create ambiguous keys.

It is **not** the Phase 23 idempotency key. Idempotency policy, posting purpose and payload fingerprint remain Step 15.

## Argin Bridge Boundary

Step 4 establishes fields that the future Bridge envelope must preserve:

- durable source system/type/ID;
- source version/revision;
- Company/Branch scope;
- request/operation identity;
- correlation/causation chain.

Step 22 will add the final versioned Bridge envelope, schema metadata and transport contract.

Step 4 intentionally does not add:

- Bridge schema version;
- transport acknowledgements;
- synchronization cursor/state;
- payload fingerprint;
- idempotency key;
- conflict-resolution protocol.

## Invariants

- no source identity may depend on SQLite row IDs;
- only the Purchase source system is accepted in Phase 23;
- source version is a positive safe integer;
- source revision is null or a positive safe integer;
- source identity scope must match the captured Posting Fact;
- source type/ID/version must match the captured Posting Fact;
- line references must point to an actual captured Purchase line;
- request/operation/correlation IDs are required;
- causation is optional only for root operations;
- self-causation is invalid;
- Source Identity and Trace Context are immutable.

## Non-Scope

Step 4 does not decide:

- which Purchase source types/statuses create accounting events — Step 5;
- account resolution — Step 6;
- posting formulas — Steps 7–11;
- idempotency/replay behavior — Step 15;
- persistence — Steps 20–21;
- final Argin Bridge envelope — Step 22.
