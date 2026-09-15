# Purchase Document Types and Lifecycle

## Scope

Phase 22 Step 5 defines Purchase document classifications and lifecycle semantics only. Numbering, fiscal scope, persistence, posting, Inventory/Valuation side effects and return/correction orchestration remain owned by later steps.

## Document Types

The Purchase domain recognizes four durable document types:

- `purchase-order`
- `supplier-invoice`
- `purchase-return`
- `purchase-correction`

Inventory receipt remains an Inventory-owned fact and is not modeled as a Purchase document type.

## Statuses

The lifecycle statuses are:

- `draft`
- `submitted`
- `approved`
- `confirmed`
- `cancelled`
- `returned`
- `corrected`

Approval and confirmation are deliberately separate. Only `confirmed` is the lifecycle gate that later steps may use to create Inventory/Valuation or future accounting effects.

## Transition Matrix

- `draft -> submitted | cancelled`
- `submitted -> draft | approved | cancelled`
- `approved -> draft | confirmed | cancelled`
- `confirmed -> returned | corrected`
- `cancelled`, `returned`, and `corrected` are terminal in Step 5.

Reopening an approved document to draft requires a reason. Returning or correcting a confirmed Purchase fact requires both a reason and a separate related compensating document ID. Self-linking is rejected.

## Historical Integrity

Lifecycle history is immutable and chronological. Each transition stores source status, target status, occurred-at timestamp, actor user ID, optional reason, and related document ID when required.

Confirmed historical Purchase facts are never silently rewritten. Later Step 12 workflows create and coordinate the linked return/correction facts represented by the Step 5 relationship contract.

## Aggregate Version

Lifecycle transitions increment aggregate version, but version is not defined as `history.length + 1`. Future draft edits and Step 17 optimistic concurrency can increment the same aggregate version independently of lifecycle transition count.

## Argin Bridge

Document type, status, lifecycle history, related compensating document identity, timestamps and aggregate version are persistence-neutral authoritative Purchase facts. They are designed to serialize consistently across SQLite Desktop and future PostgreSQL/.NET implementations. The complete Bridge envelope remains Step 18 scope.
