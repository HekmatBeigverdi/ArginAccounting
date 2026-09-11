# Inventory Valuation Policy

## Purpose

Phase 21 Step 4 defines how ArginAccounting selects FIFO or Moving Weighted Average for Product/Warehouse valuation streams without making the method a document-level, Product-level or Warehouse-level switch.

## Company-scoped policy

Per approved CR-21-001, valuation method is a Company accounting policy in Phase 21.

A Product/Warehouse stream does not own its own valuation method. Instead, every confirmed movement resolves the Company policy that was effective on the movement business date and carries that policy method/version into valuation.

This avoids mixed valuation methods inside one Company unless an explicit future Change Request expands policy scope.

## Initial configuration

Before authoritative monetary valuation begins, a Company creates an initial policy containing:

- durable `policyId`;
- `companyId`;
- valuation method (`fifo` or `moving_average`);
- strategy version;
- currency;
- `effectiveFrom` business date;
- revision.

The initial policy has no previous-policy reference.

## Lock after first valuation

Once authoritative monetary valuation exists, ordinary direct mutation of the active method is locked. The active policy record is not edited in place merely because Company settings changed.

This makes policy history auditable and keeps historical valuation reproducible.

## Controlled policy transition

A later method change creates a new policy record with:

- a new durable `policyId`;
- the same `companyId`;
- the new method/version/currency;
- a later `effectiveFrom` business date;
- `previousPolicyId` pointing to the preceding policy;
- mandatory `changeReason`;
- incremented revision.

The preferred operational path is a new-fiscal-year effective date. Fiscal-boundary validation and authorization belong to later Application/Security steps; Step 4 provides the persistence-neutral historical model and chronology guards.

## Historical resolution

Policy resolution uses Company + movement business date. Product and Warehouse IDs are carried as valuation context, but they do not select a different method.

For an as-of business date, the effective Company policy is the latest non-overlapping policy whose `effectiveFrom` is not later than that date.

No applicable policy is an error. Two policies effective on the same date for one Company are an overlap and are rejected.

## History integrity

`assertInventoryValuationPolicyHistory` validates a deterministic transition chain:

- the first policy has no predecessor;
- each later policy has a strictly later effective date;
- no effective-date overlap exists;
- each transition references the immediately preceding policy.

This allows Desktop SQLite and a future server implementation to resolve identical policy chronology.

## Argin Bridge implications

Authoritative policy history is synchronization-worthy state. Bridge-safe requirements are:

- durable policy identity independent of SQLite row id;
- stable Company identity;
- method and strategy version explicitly carried;
- explicit currency and `effectiveFrom`;
- revision and previous-policy linkage;
- deterministic chronology and overlap rejection;
- no mutable local-only setting capable of overriding synchronized policy history.

Product/Warehouse valuation streams synchronize or derive their valuation facts against the same Company policy chronology, so future SQLite and PostgreSQL/.NET nodes can converge deterministically.

## Out of scope

Step 4 does not implement SQLite persistence, fiscal-year service integration, permissions, Audit sink, UI, policy-transition command handlers, recalculation execution, negative-stock policy, Purchase costing or accounting posting. Product/Category/Warehouse valuation-method overrides remain outside Phase 21 unless approved by a later Change Request.
