# Sales Posting Reconciliation and Accounting Examples

## Purpose

This document is the canonical Phase 25 accounting-reconciliation guide for Sales Posting.

It explains how to reconcile:

- Sales commercial totals;
- Accounts Receivable;
- Sales Revenue;
- Output VAT;
- Inventory Valuation;
- COGS;
- Inventory relief/restoration;
- Sales Posting identity;
- Accounting Journal identity.

The accounting examples use Iranian Rial (IRR).

## Core Rule

A Sales Journal can contain two independent accounting effects:

1. commercial recognition;
2. inventory-cost recognition.

Therefore:

```text
Journal total debit/credit may be greater than Invoice grand total.
```

The correct reconciliation criterion is not:

```text
Journal Total = Invoice Total
```

It is:

```text
Commercial leg reconciles to Sales
+
Cost leg reconciles to Inventory Valuation
+
Journal Debit = Journal Credit
```

## Reconciliation Equation

For a normal stock Sales Invoice:

```text
AR = Sales Grand Total

Revenue = Sales Tax Base Amount

Output VAT = Sales Tax Amount

COGS = absolute authoritative outbound Valuation cost

Inventory Relief = COGS

Total Debit = AR + COGS

Total Credit = Revenue + Output VAT + Inventory Relief
```

Because:

```text
AR = Revenue + Output VAT
```

and:

```text
COGS = Inventory Relief
```

the Journal balances:

```text
AR + COGS
=
Revenue + Output VAT + Inventory Relief
```

## Example 1 — Stock Sale Without VAT

Sales facts:

```text
Sales Revenue = 1,425,000 IRR
VAT           =         0 IRR
Grand Total   = 1,425,000 IRR
```

Resolved Inventory Valuation:

```text
COGS = 1,666,667 IRR
```

Commercial entry:

```text
Accounts Receivable    Dr  1,425,000
    Sales Revenue          Cr  1,425,000
```

Cost entry:

```text
COGS                   Dr  1,666,667
    Inventory              Cr  1,666,667
```

Combined Journal:

```text
Accounts Receivable    Dr  1,425,000
COGS                   Dr  1,666,667

    Sales Revenue          Cr  1,425,000
    Inventory              Cr  1,666,667
```

Totals:

```text
Total Debit  = 3,091,667
Total Credit = 3,091,667
```

The invoice total is still:

```text
1,425,000
```

There is no mismatch.

The extra:

```text
1,666,667
```

is not additional revenue or receivable. It is the independent COGS/Inventory effect.

### Gross margin

```text
Gross Margin
= Revenue - COGS
= 1,425,000 - 1,666,667
= -241,667 IRR
```

This is a real gross loss.

If CR-24-01 allowed or approved the below-cost sale, Phase 25 must preserve this loss.

It must not substitute the Sales amount for Inventory cost just to make margin non-negative.

## Example 2 — Stock Sale With VAT

Assume:

```text
Tax Base = 10,000,000
VAT      = 1,000,000
Grand Total = 11,000,000

Resolved COGS = 7,500,000
```

Journal:

```text
Accounts Receivable    Dr  11,000,000
COGS                   Dr   7,500,000

    Sales Revenue          Cr  10,000,000
    Output VAT             Cr   1,000,000
    Inventory              Cr   7,500,000
```

Totals:

```text
Debit  = 18,500,000
Credit = 18,500,000
```

Again:

```text
Journal total ≠ Invoice total
```

and that is expected.

## Example 3 — Zero-Rate / Zero Calculated VAT

A line may retain a Tax definition while its calculated tax amount is zero.

Accounting rule:

```text
taxAmount = 0
→ no Output VAT accounting line
```

Correct entry:

```text
Accounts Receivable    Dr  5,000,000
    Sales Revenue          Cr  5,000,000
```

Incorrect entry:

```text
Accounts Receivable    Dr  5,000,000
    Sales Revenue          Cr  5,000,000
    Output VAT             Cr          0
```

Phase 25 intentionally does not fabricate a zero-value VAT component.

## Example 4 — Service-Only Sale

Assume:

```text
Service Revenue = 2,000,000
VAT             =   200,000
Grand Total     = 2,200,000
```

Journal:

```text
Accounts Receivable    Dr  2,200,000
    Service Revenue        Cr  2,000,000
    Output VAT             Cr    200,000
```

There is no:

- Inventory Issue;
- Inventory Movement;
- Inventory Valuation;
- COGS;
- Inventory relief.

## Example 5 — Mixed Product + Service Invoice

Assume:

Stock line:

```text
Sales base = 4,000,000
COGS       = 2,500,000
```

Service line:

```text
Service base = 1,000,000
```

Total VAT:

```text
500,000
```

Grand Total:

```text
5,500,000
```

Journal:

```text
Accounts Receivable    Dr  5,500,000
COGS                   Dr  2,500,000

    Goods Revenue          Cr  4,000,000
    Service Revenue        Cr  1,000,000
    Output VAT             Cr    500,000
    Inventory              Cr  2,500,000
```

Cost is attached only to the stock line.

The service line must never receive COGS/Inventory merely because it shares the same invoice.

## Example 6 — Sales Return

Assume the original sale recognized:

```text
Revenue = 3,000,000
VAT     =   300,000
COGS    = 2,100,000
```

Return commercial reversal:

```text
Sales Revenue          Dr  3,000,000
Output VAT             Dr    300,000
    Accounts Receivable    Cr  3,300,000
```

Return cost restoration:

```text
Inventory              Dr  2,100,000
    COGS                   Cr  2,100,000
```

Combined return Journal:

```text
Sales Revenue          Dr  3,000,000
Output VAT             Dr    300,000
Inventory              Dr  2,100,000

    Accounts Receivable    Cr  3,300,000
    COGS                   Cr  2,100,000
```

The Inventory restoration value comes from the return Receipt valuation lineage.

It is not calculated from the Sales Return selling price.

## Example 7 — Partial Return

Suppose two units were sold but one unit is returned.

Original valuation:

```text
2 units total COGS = 2,000,000
```

If the authoritative return valuation restores:

```text
1 unit = 1,000,000
```

the return cost entry is:

```text
Inventory              Dr  1,000,000
    COGS                   Cr  1,000,000
```

Do not reverse the full original COGS unless the full quantity is actually returned and the return valuation supports it.

## Example 8 — Correction

Sales Correction does not edit the original Journal.

Conceptually:

```text
Original Journal
    ↓ remains immutable
Reversal effect
    ↓
Replacement effect
```

The original and replacement have independent durable source identities and versions.

## Gross Margin Reconciliation

For a normal stock sale:

```text
Gross Margin = Revenue - COGS
```

Margin percentage:

```text
Gross Margin % = Gross Margin / Revenue × 100
```

Example:

```text
Revenue = 1,425,000
COGS    = 1,666,667

Gross Margin = -241,667
Gross Margin % ≈ -16.96%
```

This differs from the Phase 24 pre-finalization below-cost guard basis when inventory state changes before Issue confirmation.

Both facts must remain traceable:

```text
Phase 24 cost quote
→ commercial governance evidence

Phase 25 actual valuation
→ final accounting COGS
```

## Reconciliation Checklist — Sales Invoice

For each finalized Sales Invoice:

| Check | Expected |
|---|---|
| Sales source version | Exact finalized source version retained |
| Customer | Journal A/R provenance matches Sales Customer |
| Currency | Commercial and valuation currency are compatible |
| Grand Total | Equals A/R debit |
| Tax Base | Equals total Revenue credit |
| Tax Amount | Equals Output VAT credit |
| Zero VAT | No Output VAT component |
| Stock line Issue | Exactly one authoritative Inventory Issue path |
| Movement | Exact Issue line Movement retained |
| Valuation | Exact resolved Valuation Entry/revision retained |
| COGS | Equals absolute resolved outbound valuation cost |
| Inventory relief | Equals COGS |
| Service line | No Inventory/COGS effect |
| Journal balance | Total Debit = Total Credit |
| Posting identity | One Posting for source/version |
| Journal identity | One committed Journal for source/version |
| Replay | Returns same Journal; no duplicate effect |

## Reconciliation Checklist — Sales Return

| Check | Expected |
|---|---|
| Return source | `sales-return` |
| Original invoice | Original Invoice ID retained |
| Return line | Original Invoice line lineage retained |
| Inventory document | Receipt, not Issue |
| Movement sign | Positive inbound |
| Valuation | Resolved inbound valuation |
| Revenue | Debit reversal |
| Output VAT | Debit reversal when applicable |
| A/R | Credit reversal |
| Inventory | Debit restoration |
| COGS | Credit reversal/restoration |
| Journal | Balanced |
| Replay | Same committed Journal |

## Reconciliation by System Authority

### Sales

Validate:

```text
documentId
sourceVersion
lineId
customerPartyId
taxBaseAmount
taxAmount
grandTotal
```

### Inventory

Validate:

```text
inventoryDocumentId
inventoryLineId
movementId
warehouseId
quantityDelta
```

### Inventory Valuation

Validate:

```text
valuationEntryId
method
strategyVersion
revision
quantity
unitCost
totalCost
valuedAt
```

### Sales Posting

Validate:

```text
postingId
source identity
postingVersion
idempotency key
payload fingerprint
recovery state
```

### Accounting

Validate:

```text
journalVoucherId
journalLineId
accountId
debit/credit amount
source provenance
```

## Account-Mapping Safety

A balanced Journal can still be semantically wrong if the wrong account is selected.

Example of an unsafe mapping for an ordinary purchased trading item:

```text
فروش محصولات تولیدی
کالای ساخته‌شده
```

when the item is actually purchased merchandise.

Therefore reconciliation must check both:

```text
Amount correctness
AND
Account semantic correctness
```

Current automatic bootstrap is conservative:

```text
stock revenue → revenue.operating.goods
inventory      → assets.current.inventory
COGS           → costs.merchandise.sold
service        → revenue.operating.services
```

It does not automatically cross from Trading to Manufacturing accounts.

When exact mapping is unavailable:

```text
blocked
→ manual review
```

An explicit Posting Rule may be configured by an authorized administrator.

## Common Failure States

### waiting-for-issue

Meaning:

```text
Sales Invoice is finalized
but Inventory Issue is not available yet
```

Action:

- do not create COGS;
- wait for Inventory fulfillment.

### waiting-for-confirmation

Meaning:

```text
Inventory document exists
but is not confirmed
```

Action:

- do not infer stock movement.

### waiting-for-movement

Meaning:

```text
Inventory document is confirmed
but required Movement lineage is not available
```

Action:

- investigate Inventory persistence/lineage.

### waiting-for-valuation

Meaning:

```text
Movement exists
but Valuation is missing or unresolved
```

Action:

- use valuation recovery;
- if chronology-blocked, use controlled historical rebuild.

### account mapping error

Meaning:

- required Sales Posting Rule is missing;
- account is inactive/non-postable;
- multiple equally specific rules are ambiguous.

Action:

```text
blocked
→ manual review
```

Do not silently choose a fallback account from another business model.

## Journal Total Versus Invoice Total

A frequent misunderstanding is comparing the Journal debit/credit total directly to the invoice total.

For stock Sales:

```text
Journal Debit Total
= Invoice Grand Total + COGS
```

and:

```text
Journal Credit Total
= Revenue + VAT + Inventory Relief
```

Because:

```text
Invoice Grand Total = Revenue + VAT
```

the two Journal sides balance.

This does not mean the customer owes COGS.

Customer debt remains only the A/R amount.

## Drill-Down Trace

The intended trace is:

```text
Journal line
    ↓
Journal Voucher
    ↓
Sales Posting
    ↓
Sales source/version
    ↓
Sales line
    ↓
Inventory Issue/Receipt line
    ↓
Movement
    ↓
Valuation Entry/revision
```

For commercial-only service lines, the Inventory part of the chain is intentionally absent.

## Exactly-Once Reconciliation

When the same source/version is evaluated again:

```text
same source identity
+
same compatible fingerprint
→ replay existing outcome
```

Expected counts remain:

```text
1 Posting
1 Journal
1 accounting-recognition idempotency outcome
1 durable accounting effect
```

If the same identity arrives with incompatible facts:

```text
→ conflict
```

It must not create another Journal.

## Operational Reconciliation Procedure

Recommended operator/QA sequence:

1. Open the finalized Sales document.
2. Record Sales grand total, tax base and tax amount.
3. For stock lines, open the related Inventory Issue/Receipt.
4. Verify the Inventory document is confirmed.
5. Verify the exact Movement exists.
6. Open Inventory Valuation and verify the Movement has a resolved Valuation Entry.
7. Record valuation entry ID, revision and total cost.
8. Return to Sales and refresh Posting status.
9. Verify state is `committed`.
10. Record Journal Voucher ID.
11. Open Accounting Documents.
12. Verify A/R, Revenue, VAT, COGS and Inventory amounts against the formulas in this document.
13. Verify Total Debit equals Total Credit.
14. Verify account semantics, not only amounts.
15. Refresh/retry again and verify the same Journal ID is returned.

## Related Documentation

- [Phase 25 — Sales Posting](../phases/phase-25-sales-posting.md)
- [Phase 25 Implementation Plan](../phases/phase-25-sales-posting-plan.md)
- [Sales Fulfillment and Posting Handoff](../architecture/sales-fulfillment-posting-handoff.md)
- [CR-24-01 Below-Cost Sales Policy](../architecture/cr-24-01-below-cost-sales-policy.md)
