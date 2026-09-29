# Automatic Purchase Posting Orchestrator

## Purpose

Phase 23 Step 29 closes the runtime gap between a confirmed/eligible Supplier Invoice and the Accounting Journal. The orchestrator coordinates authoritative Purchase, Inventory Valuation, Posting Rules and Accounting boundaries; the React page never calculates Debit/Credit lines itself.

## Runtime flow

For a Supplier Invoice:

```text
Confirmed Supplier Invoice
        ↓
Fulfillment / Matching eligibility
        ↓
Resolved Inventory Valuation (stock lines)
        ↓
Purchase Posting plans
        ↓
Tax / Charge policy
        ↓
Posting Rule account resolution
        ↓
Draft Journal generation
        ↓
Replay-safe atomic commit
        ↓
Purchase Posting = prepared
Journal Voucher = draft
```

The generated Journal appears in Accounting immediately as a system-created draft. Its later submit/approval/final-post lifecycle remains owned by Accounting.

## Automatic mode

The current desktop baseline uses the Step 26 `automatic` policy.

- Service and non-stock lines may post immediately after Supplier Invoice confirmation.
- Stock lines require complete receipt/matching coverage.
- Stock lines also require resolved Inventory Valuation entries.
- When the final confirmed receipt is matched, the Purchase workspace resolves Purchase-backed valuation cost and invokes the Posting Orchestrator automatically.
- The Posting panel retains an explicit **Create accounting posting** action as a safe recovery/manual retry path for authorized users.

The `accountant-approval` domain mode remains supported by the orchestrator contract. In that mode the orchestrator returns an awaiting-approval state and does not create a Journal until the authorized approval command is introduced/configured by the workspace policy surface.

## Accounting ownership

Step 29 creates a Journal **draft** through the Posting application boundary. It does not bypass Accounting lifecycle controls.

The normal result is:

```text
Purchase Posting: prepared
Accounting Journal: draft
```

This is intentional. Final GL posting, approval, lock checks and reversal stay in the Accounting lifecycle.

## Source facts

The desktop adapter rebuilds the posting snapshot from durable authorities:

- Purchase document/supplier/item snapshots;
- current Purchase Commercial Facts;
- immutable Receipt/Invoice match facts;
- resolved Inventory Valuation entries;
- effective valuation policy identity.

No commercial amount is re-entered in the Posting UI.

## VAT baseline

Normal Purchase VAT is treated as recoverable in the current automatic baseline, consistent with the existing Purchase valuation contract where recoverable VAT is excluded from normal stock Cost Input.

A future company tax-policy surface may explicitly switch recoverability without changing the orchestration contract.

## Posting Rules

The orchestrator does not invent account mappings.

All Debit/Credit accounts are resolved through `purchase_posting_rules`. Missing or ambiguous mappings block Journal creation with a domain error rather than silently selecting an account.

For companies created from Argin built-in coding templates, Desktop composition may bootstrap the core `inventory-asset` and `accounts-payable` Purchase rules from known built-in logical account identities when no applicable rule exists. This is deterministic configuration bootstrap, not heuristic account-name matching. Ambiguous or unavailable mappings still fail closed.

This preserves enterprise accounting control. Typical roles include:

- `inventory-asset`
- `purchase-expense`
- `accounts-payable`
- `input-vat-recoverable`
- `purchase-charge`

GR/IR-ready roles remain available for later configured workflows.

## Replay safety

Posting identity is deterministic by Purchase source and source version.

The runtime uses:

- deterministic Purchase Posting ID;
- deterministic Journal ID and Journal line IDs;
- source-version Posting idempotency identity;
- SHA-256 payload fingerprint;
- replay-safe Purchase Posting commit;
- optimistic Posting version checks.

Repeated execution for the same compatible source version returns the committed prepared Posting/Journal instead of creating a duplicate Journal.

## Failure behavior

The Purchase document is never rolled back merely because automatic accounting cannot run.

Examples that defer/block accounting include:

- missing Receipt/Matching for stock;
- unresolved Inventory Valuation;
- missing Posting Rule;
- required accounting dimension not resolvable;
- fiscal period/lock violation;
- replay fingerprint conflict.

The business document remains confirmed and the Posting panel shows the actionable error/retry surface.

If a required Accounts Payable PARTY dimension has no Accounting Dimension Member, Desktop composition materializes the module-owned member from the durable Supplier master identity before Journal generation. Display name is presentation data; Supplier ID is the durable source reference.

Generated Purchase Journal descriptions are business-readable Persian text. Internal component IDs such as principal/tax/charge identifiers are never used as end-user Journal descriptions.

A Purchase-generated Journal draft is source-owned. Generic Accounting edit/delete operations are forbidden even while the Journal is draft; correction must originate from the source workflow or a controlled correction/reversal path.

## Argin Bridge

The authoritative synchronized facts are the Purchase source version, Purchase Posting aggregate, Journal Voucher, idempotency record and durable source lineage.

UI-derived eligibility labels are rebuildable and are not synchronization authority.
