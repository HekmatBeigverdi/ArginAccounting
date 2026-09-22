# Purchase Posting Rules and Account Resolution

## Status

Phase 23 Step 6.

Step 6 defines role-based account mapping. It does not calculate debit/credit amounts or create Journal Lines.

## Account Roles

The frozen minimum Purchase roles are:

- `inventory-asset`
- `purchase-expense`
- `accounts-payable`
- `input-vat-recoverable`
- `purchase-charge`
- `grni`

Purchase Posting never hard-codes Chart of Accounts IDs.

## Rule Scope

A `PurchasePostingRule` may be scoped by:

- Company — mandatory;
- Branch — optional;
- Posting event kind — optional;
- line kind — optional;
- account role — mandatory.

The rule resolves to a concrete `accountId`.

Specific rules win over generic rules. For equal specificity, higher explicit priority wins. Equal specificity + equal priority is ambiguous and fails explicitly.

## Resolution Order

Specificity is:

```text
Branch + Event Kind + Line Kind
        >
less-specific combinations
        >
Company-wide role fallback
```

No silent fallback account exists when no rule matches.

## Account Validation

A resolved account must:

- exist;
- belong to the same Company;
- be active;
- allow posting.

Inactive, cross-company or non-postable accounts fail before Journal generation.

## Separation from Debit/Credit Semantics

Step 6 only answers:

> Which concrete account represents this accounting role for this context?

It does not decide whether that account is debit or credit or which monetary amount is applied.

Those semantics are frozen in Steps 7–11.

## Dimensions

Cost Center, Project, Party, Product, Warehouse and other accounting dimensions are not resolved here. Their validation/assignment remains Step 19.

## Argin Bridge

Posting Rules are configuration/domain facts. Durable rule/account identities can later be synchronized, but Step 6 introduces no Bridge transport or persistence schema.

## Non-Scope

- Supplier Invoice formulas — Step 7
- VAT semantics — Step 8
- Purchase Charges — Step 9
- Return formulas — Step 10
- Correction formulas — Step 11
- Dimensions — Step 19
- Persistence — Steps 20–21
