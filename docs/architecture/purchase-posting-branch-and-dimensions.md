# Branch and Accounting Dimensions

## Status

Phase 23 Step 19.

Step 19 integrates Purchase Posting with the existing Phase 11 Accounting Dimensions model.

## Branch

Branch remains a first-class Journal Voucher scope:

```text
Purchase Fact branchId
        ↓
JournalVoucher.branchId
```

Purchase Posting does not create a second Branch dimension automatically.

Account resolution already receives Branch in Step 6, and Fiscal/Concurrency gates preserve the same Branch scope.

## Accounting Dimension Sources

Purchase Posting can provide semantic business references for:

- Party — Supplier;
- Product — Purchase line item;
- Warehouse — authoritative valuation snapshots;
- Cost Center — explicit posting context;
- Project — explicit posting context.

These are business/source references, not Accounting Dimension Member IDs.

## No Direct Operational IDs in Journal Assignment

The Posting layer never writes:

```text
supplierId
productId
warehouseId
costCenterId
projectId
```

directly into `dimensionAssignments`.

Instead:

```text
Business reference
        ↓
PurchasePostingDimensionReader
        ↓
AccountingDimensionMember
        ↓
AccountingDimensionAssignment
```

This preserves the Phase 11 ownership boundary.

## Policy-Driven Assignment

For each resolved Account, Step 19 loads its existing `AccountDimensionPolicy`.

Behavior:

- `required` — a valid Member must resolve or posting fails;
- `optional` — resolved Member is assigned when available;
- `forbidden` — no automatic assignment is emitted;
- no policy — no automatic assignment is emitted.

The final assignments are validated by Accounting's existing `validateAccountingDimensionAssignments` function.

## Party

Document-level components such as Accounts Payable have no Purchase line ID.

They can still receive Supplier/Party dimension because Party comes from the Purchase Fact supplier snapshot.

## Product and Warehouse

Product and Warehouse are line-specific.

- Product comes from `line.item.itemId`.
- Warehouse comes only from authoritative valuation snapshots linked to that line.

No Warehouse is invented for service/non-stock lines.

If multiple valuation snapshots reference multiple warehouses, all distinct Warehouse business references are exposed to the resolver. Accounting's dimension type policy then decides whether multiple members are allowed.

## Cost Center and Project

The current Purchase Fact does not own Cost Center or Project facts.

Therefore Step 19 does not add editable Cost Center/Project fields to Purchase Posting snapshots.

They are supplied as optional posting context:

```text
PurchasePostingDimensionContext
  costCenterId
  projectId
```

and then resolved through the same Accounting Dimension Member boundary.

## Validation

The existing Accounting validation remains authoritative for:

- required/optional/forbidden policy;
- active Dimension Type;
- active Member;
- Company scope;
- Dimension Type/Member match;
- validity dates;
- duplicate members;
- multiple-member allowance.

Purchase Posting converts those failures into a posting-domain validation failure before Journal persistence.

## Determinism

Dimension assignments are normalized deterministically:

- one Assignment per Dimension Type;
- unique Member IDs;
- stable sorted Dimension Type IDs;
- stable sorted Member IDs.

This is important for replay fingerprints and future Argin Bridge transport.

## Non-Scope

- Dimension setup/master-data UI — Phase 11;
- Dimension selector UI — existing Accounting contract;
- persistence — Steps 20–21;
- Bridge contracts — Step 22.
