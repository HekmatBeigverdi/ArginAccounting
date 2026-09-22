# Purchase Posting Event Classification

## Status

Phase 23 Step 5.

This document defines whether an immutable Purchase Posting Fact represents an accounting-recognition event. It does not resolve accounts, calculate debit/credit lines, validate valuation readiness, or create Journal Vouchers.

## Why Classification Exists

Purchase lifecycle status and accounting-event meaning are not the same thing.

A Purchase document can be historically relevant without creating a new accounting event.

The classifier therefore converts:

```text
documentType + sourceStatus
        ↓
posting | non-posting | ineligible
```

## Dispositions

### posting

The source Fact represents an independent accounting-recognition event.

### non-posting

The source Fact is valid historical/business state but must not create a new Journal effect.

### ineligible

The supplied type/status combination is not eligible to create a Purchase Posting event under the frozen Phase 23 workflow.

Step 5 does not use a separate `deferred` disposition. Readiness that depends on Inventory Valuation, account mapping, Fiscal locks or other downstream prerequisites belongs to Steps 6, 12 and 18 rather than event classification.

## Frozen Matrix

| Document type | Source status | Disposition | Event kind | Reason |
| --- | --- | --- | --- | --- |
| purchase-order | confirmed | non-posting | none | Purchase Order has no accounting effect |
| purchase-order | returned | non-posting | none | Purchase Order has no accounting effect |
| purchase-order | corrected | non-posting | none | Purchase Order has no accounting effect |
| supplier-invoice | confirmed | posting | supplier-invoice-recognition | confirmed invoice is independently recognized |
| supplier-invoice | returned | non-posting | none | compensating Purchase Return owns the new effect |
| supplier-invoice | corrected | non-posting | none | compensating Purchase Correction owns the new effect |
| purchase-return | confirmed | posting | purchase-return-recognition | confirmed return is an independent compensating event |
| purchase-return | returned | ineligible | none | compensating document must itself be confirmed |
| purchase-return | corrected | ineligible | none | compensating document must itself be confirmed |
| purchase-correction | confirmed | posting | purchase-correction-recognition | confirmed correction is an independent compensating event |
| purchase-correction | returned | ineligible | none | compensating document must itself be confirmed |
| purchase-correction | corrected | ineligible | none | compensating document must itself be confirmed |

## Original Invoice vs Compensating Document

Phase 22 establishes that confirmed commercial history is immutable.

A Purchase Return or Purchase Correction is a new durable Purchase document. It does not rewrite the confirmed Supplier Invoice.

Therefore:

```text
Supplier Invoice confirmed
        ↓
posting event

Supplier Invoice later marked returned
        ↓
NO second posting from the original invoice

Confirmed Purchase Return document
        ↓
new independent posting event
```

The same rule applies to Purchase Correction.

This avoids duplicate accounting effects.

## Event Kinds

Step 5 freezes three posting event kinds:

- `supplier-invoice-recognition`;
- `purchase-return-recognition`;
- `purchase-correction-recognition`.

`none` is used for non-posting/ineligible facts.

The event kind says **what accounting event occurred**, not which accounts or debit/credit directions will be used.

Those rules begin in Step 6 and document-specific semantics continue in Steps 7–11.

## Purchase Order

Under the frozen Phase 23 baseline, Purchase Order never creates a Journal effect.

It can still be preserved as a valid Fact for provenance and workflow traceability.

Changing this in a future phase would require an explicit approved rule/change request.

## Valuation Readiness Is Not Event Classification

A stock-product Supplier Invoice may classify as:

```text
posting
```

while still lacking a required resolved Valuation result.

That does not change the business event into `ineligible` at Step 5.

Valuation-readiness validation is owned by Step 12.

This keeps event semantics separate from downstream technical/accounting prerequisites.

## Argin Bridge

Event classification is deterministic from immutable source type/status and therefore rebuildable.

Bridge synchronization should preserve the authoritative source Fact and durable source identity. Classification can be recomputed and does not need to become an independently editable authority.

## Non-Scope

Step 5 does not implement:

- Account Resolution — Step 6;
- Supplier Invoice accounting lines — Step 7;
- VAT/charge semantics — Steps 8–9;
- Return/Correction debit-credit rules — Steps 10–11;
- Valuation-readiness checks — Step 12;
- Journal generation — Step 13;
- Idempotency/replay — Step 15;
- Fiscal lock validation — Step 18.
