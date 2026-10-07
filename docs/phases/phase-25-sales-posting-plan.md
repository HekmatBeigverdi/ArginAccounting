# Phase 25 — Sales Posting — Fixed Implementation Plan

## Status

Step 1 is complete. Phase 25 has formally started on `phase/25-sales-posting`; the 30-step plan, handoff contract, ownership boundaries, Argin Bridge boundary and release target are frozen.

## Governance

The 30 step titles, order, scope and ownership boundaries are frozen at Phase 25 start. Any change requires an explicitly approved Change Request recorded in this canonical phase record. Owner acceptance and executable validation evidence remain separate.

Mandatory references:

- [Documentation Governance](../development/documentation-governance.md)
- [Phase Definition of Done](../development/phase-definition-of-done.md)
- [Roadmap](../../ROADMAP.md)
- [Phase 24 — Sales Workflow](phase-24-sales-workflow-plan.md)
- [Phase 24 -> Phase 25 Sales Fulfillment and Posting Handoff](../architecture/sales-fulfillment-posting-handoff.md)
- [CR-24-01 — Below-Cost Sales Policy & Guard](../architecture/cr-24-01-below-cost-sales-policy.md)
- [Phase 21 — Inventory Valuation](phase-21-inventory-valuation-plan.md)
- [Phase 13 — Journal Voucher Engine](phase-13-journal-voucher-engine.md)
- [Phase 15 — Journal Lifecycle](phase-15-journal-lifecycle.md)

## Baseline and Release Target

- Baseline branch: `main`.
- Baseline commit: `044a3ed1abbd847da7675c6bf70dcd9510f6f648`.
- Baseline commit message: `merge: release phase 24 sales workflow`.
- Baseline includes the completed Phase 24 Sales Workflow merge to `main`.
- Phase branch: `phase/25-sales-posting`.
- Target version: `0.25.0` / `v0.25.0`.
- Release title: `ArginAccounting v0.25.0 — Sales Posting`.

## Mission

Phase 25 converts authoritative Phase 24 Sales commercial facts and Phase 21 Inventory Valuation outputs into balanced, idempotent Accounting journal effects without duplicating Sales, Inventory, Valuation or Journal authority.

Below-cost approval/warning is a commercial governance decision, not a cost source. Phase 24 evaluates a pre-finalization Phase 21 cost quote against the net Sales amount before VAT and persists its policy/approval trace. Phase 25 accepts legitimate loss-making sales that were allowed/approved, calculates COGS only from the actual resolved outbound valuation entry, preserves both quote/basis and actual valuation provenance, and reports actual gross margin without rewriting Sales or Inventory facts.

Canonical dependency direction:

```text
Finalized Sales Invoice
        ↓
Inventory Issue Draft
        ↓
Inventory Issue Finalized / Confirmed
        ↓
Authoritative Inventory Movement
        ↓
Phase 21 FIFO / MWA Valuation
        ↓
Phase 25 Sales Posting
        ↓
Journal Voucher
```

## Ownership Boundaries

### Phase 25 owns

- Sales-specific accounting orchestration from authoritative upstream facts.
- Revenue, Accounts Receivable and Output VAT posting effects derived from immutable Sales commercial facts.
- COGS and Inventory Relief posting effects derived from resolved Phase 21 outbound valuation facts.
- Durable Sales Posting identity, status, replay safety, recovery and posting provenance.
- Correlation of Sales document/line lineage with Inventory movement/valuation lineage and Journal source provenance.
- Sales Return accounting reversal/adjustment orchestration using explicit lineage.
- Sales Correction/replacement/reversal accounting lineage.
- Persian RTL Sales Posting status/recovery surfaces and operational trace.

### Phase 25 consumes but does not own

- Customer, Product/Service and Sales commercial facts from Phase 24 and upstream Master Data.
- Inventory Issue/Receipt lifecycle and quantity movement authority from Phase 20.
- FIFO/MWA valuation and actual inventory cost authority from Phase 21.
- Journal Voucher aggregate/lifecycle rules from Phases 13 and 15.
- shared Money, Audit, Security, Approval, optimistic concurrency, Unit of Work and background/platform infrastructure.

### Explicitly out of scope

- Recalculating or rewriting Sales selling prices, discounts, charges, tax inputs or finalized commercial snapshots.
- Treating selling price, Product master price or Phase 24 pre-finalization cost quote as COGS.
- Direct writes to Inventory quantity/movement/valuation tables from Sales Posting.
- Duplicating Journal Voucher lifecycle/business rules inside Sales Posting.
- Treasury settlement, receipts, bank/cash operations and cheque workflows.
- General-purpose Posting Rules engine; Phase 29 owns that platform.
- Iranian Taxpayer submission/signing/inquiry.
- Live Argin Bridge transport, acknowledgement, remote apply, conflict resolution or server synchronization.
- PostgreSQL/server persistence implementation for Sales Posting in this phase.

## Core Invariants

- Commercial posting uses immutable Phase 24 Sales facts.
- Cost posting uses actual resolved Phase 21 FIFO/MWA valuation facts.
- Selling price is never Inventory Cost and never COGS.
- The Phase 24 cost quote is a governance input only and cannot override actual valuation.
- Finalizing a stock Sales Invoice stages exactly one Inventory Issue Draft; Invoice finalization itself does not decrease stock.
- Stock quantity decreases only when Inventory finalizes/confirms the Issue and creates the authoritative movement.
- Stock COGS/Inventory Relief cannot post before Issue -> Movement -> resolved Valuation prerequisites exist.
- Service-only invoices bypass Inventory fulfillment and cost posting.
- Mixed invoices preserve stock-line prerequisites while allowing service-line commercial posting.
- Allowed/approved below-cost sales may legitimately produce negative gross margin.
- Journal effects are exactly-once per durable business effect despite replay, retry, restart or worker concurrency.
- Same posting identity with incompatible source payload/version conflicts rather than silently overwriting.
- Historical posted facts are not mutated in place; corrections, returns and reversals preserve explicit lineage.
- Journal lines retain sufficient Sales/Inventory/Valuation provenance for audit, reconciliation and deterministic reversal.
- Phase 25 remains persistence-neutral above adapters and offline-first on SQLite.
- New durable identities, source references, versions and change metadata remain compatible with future Argin Bridge synchronization.

## Argin Bridge Boundary

Phase 25 prepares durable, persistence-neutral posting contracts for the future path:

```text
Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization
```

The phase preserves stable posting IDs, source/external references, operation/request identity, version/change metadata, idempotency evidence, immutable source provenance and reversal lineage. It does not implement live remote synchronization.

This follows the permanent bridge rule: **sync-ready contracts now; live transport later**.

## Required Accounting Effects

Commercial leg:

```text
Accounts Receivable    Dr
    Sales Revenue          Cr
    Output VAT             Cr
```

Cost leg for stock products:

```text
COGS                   Dr
    Inventory              Cr
```

Sales Return reverses or adjusts the corresponding commercial and inventory-cost effects through explicit source lineage rather than mutable historical edits.

## Fixed 30-Step Plan

| Step | Title | Status |
| ---: | --- | --- |
| 1 | Baseline, Handoff Contract & Ownership Verification | Completed |
| 2 | Sales Posting Domain & Durable Posting Identity | Completed |
| 3 | Commercial Posting Input from Immutable Sales Snapshots | Completed |
| 4 | Revenue Account Resolution | Completed |
| 5 | Accounts Receivable Account Resolution | Completed |
| 6 | Output VAT Account Resolution | Completed |
| 7 | Commercial Posting Calculation & Balancing | Completed |
| 8 | Stock-Fulfillment Prerequisite Contract | Completed |
| 9 | Inventory Issue Lineage Resolution | Completed |
| 10 | Outbound Inventory Movement Lineage Resolution | Completed |
| 11 | Resolved FIFO/MWA Valuation Prerequisite | Completed |
| 12 | COGS Account Resolution | Completed |
| 13 | Inventory Account Resolution | Completed |
| 14 | COGS / Inventory Relief Posting Calculation | Completed |
| 15 | Mixed Stock + Service Invoice Orchestration | Completed |
| 16 | Service-Only Invoice Posting Path | Completed |
| 17 | Automatic Post-Finalization Orchestration & Resumable Pending State | Completed |
| 18 | Idempotency & Exactly-Once Journal Effect | Completed |
| 19 | Optimistic Concurrency & Posting CAS | Completed |
| 20 | Atomic Unit of Work / Outbox Boundary | Completed |
| 21 | Sales Return Commercial Reversal | Completed |
| 22 | Sales Return Inventory Receipt / Valuation Cost Restoration | Completed |
| 23 | Sales Correction & Replacement/Reversal Lineage | Completed |
| 24 | Journal Voucher Creation & Immutable Source Provenance | Completed |
| 25 | Posting Status, Recovery & Deterministic Retry | Completed |
| 26 | Permissions, Approval/Audit & Operational Trace | Completed |
| 27 | Persian RTL Posting Status/Recovery UI | Completed |
| 28 | Automated Integration & E2E Stock/Service/Return Scenarios | Planned |
| 29 | Documentation, Reconciliation & Accounting Examples | Planned |
| 30 | Quality Gate, Merge & Release | Planned |

## Step 1 — Baseline, Handoff Contract & Ownership Verification

### Completed work

- Verified the canonical Roadmap and confirmed Phase 25 is Sales Posting.
- Verified Phase 24 is merged into `main` at commit `044a3ed1abbd847da7675c6bf70dcd9510f6f648`.
- Pinned that exact `main` commit as the Phase 25 baseline.
- Created `phase/25-sales-posting` from that exact baseline.
- Froze the 30-step implementation plan and removed provisional numbering.
- Froze the non-negotiable Sales -> Inventory -> Movement -> Valuation -> Posting -> Journal handoff.
- Froze Sales/Inventory/Valuation/Journal ownership boundaries.
- Froze the below-cost rule: Phase 24 cost quote remains governance evidence only; actual Phase 21 valuation remains the sole COGS authority.
- Froze the exactly-once/replay requirement for Journal business effects.
- Froze the Argin Bridge rule: durable sync-ready identities/contracts now; live transport later.
- Set semantic release target to `0.25.0` / `v0.25.0`.
- No Sales Posting domain implementation is introduced in Step 1; Step 2 owns the first posting domain model.

### Local verification

Repository/documentation checks for this baseline step:

```bash
git checkout phase/25-sales-posting
git rev-parse HEAD
git merge-base --is-ancestor 044a3ed1abbd847da7675c6bf70dcd9510f6f648 HEAD

node scripts/check-doc-links.mjs
```

Expected baseline SHA at branch creation:

```text
044a3ed1abbd847da7675c6bf70dcd9510f6f648
```

Step 1 intentionally has no runtime/domain test because it introduces no executable business code.

### Exit criteria

- [x] Phase 24 merge is present in the selected baseline.
- [x] Phase 25 branch exists from the exact baseline.
- [x] 30-step plan is fixed.
- [x] Handoff dependency chain is frozen.
- [x] Authority boundaries are explicit.
- [x] Selling price/cost quote cannot become COGS.
- [x] Argin Bridge boundary is explicit.
- [x] Release target is fixed.
- [x] Step 2 is the first executable/domain implementation step.

## Definition of Done Additions

Phase 25 cannot be released merely because a Journal Voucher can be generated. Release requires proof that:

- a finalized stock invoice stages exactly one Inventory Issue;
- invoice finalization itself does not alter stock;
- Inventory confirmation/finalization is the quantity-decrease authority;
- COGS waits for resolved valuation;
- revenue/VAT/receivable and COGS/inventory amounts come from their separate authoritative sources;
- replay and recovery cannot duplicate Inventory or Journal effects;
- service-only, mixed, stock-only and Sales Return paths are covered;
- Journal lines retain Sales document/line and Inventory movement/valuation provenance sufficient for audit and reversal;
- below-cost Sales that were allowed/approved can post a legitimate negative gross margin;
- posting trace can correlate Phase 24 policy/approval and valuation-basis evidence with the actual valuation entry/revision used by Phase 25;
- the Phase 24 cost quote is never posted as COGS and never overrides actual FIFO/MWA valuation;
- negative gross margin remains a legitimate accounting result when Phase 24 policy allowed or approved the transaction.

## Next Step

Step 2 — Sales Posting Domain & Durable Posting Identity.

## Step 2 — Sales Posting Domain & Durable Posting Identity

### Completed work

- Added the independent `@argin/sales-posting` package at version `0.25.0`.
- Established a persistence-neutral `SalesPostingAggregate` without coupling the Domain to React/Tauri, SQLite, Journal persistence or remote transport.
- Added durable `postingId`, Company/Branch scope, independent aggregate `version`, and canonical UTC `createdAtUtc` / `updatedAtUtc` metadata.
- Added immutable Sales source identity with fixed source system `sales`, durable `sourceDocumentId`, authoritative `sourceVersion`, optional external reference and the allowed accounting-source kinds `sales-invoice`, `sales-return`, and `sales-correction`.
- Explicitly excluded `sales-order` from Sales Posting source types because an Order is not itself an accounting-recognition source.
- Added deterministic `salesPostingSourceIdentityKey()` based only on durable source identity/version, never document number, customer/product display names or other mutable presentation metadata.
- Added domain validation for required/bounded identities, source type, positive safe versions, canonical UTC timestamps and timestamp chronology.
- Added rehydration support that remains independent from SQLite row IDs or future PostgreSQL/server identities.
- Kept commercial snapshot contents in Step 3; account resolution in Steps 4–6; orchestration state in Step 17; idempotency in Step 18; CAS transitions in Step 19; Journal linkage in Step 24; and recovery state in Step 25.
- No migration or UI change is introduced in Step 2.

### Argin Bridge compliance

The Step 2 identity boundary is transport-neutral:

```text
SalesPosting
  postingId
  companyId
  branchId
  source:
    sourceSystem = sales
    sourceType
    sourceDocumentId
    sourceVersion
    externalReference?
  version
  createdAtUtc
  updatedAtUtc
```

This gives future Argin Bridge synchronization a stable aggregate identity and stable source identity without making Desktop persistence or remote transport part of the Domain model.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-posting-domain.test.ts
```

Coverage includes:

- aggregate creation and immutability;
- identity normalization;
- supported Sales source document kinds;
- rejection of Sales Order as an accounting source;
- deterministic source identity key;
- persistence-neutral rehydration;
- missing identity rejection;
- source/aggregate version validation;
- canonical UTC validation;
- timestamp chronology validation.

Local commands:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Full repository regression may also be run with:

```bash
pnpm typecheck
pnpm test
```

### Validation note

The repository changes were structurally reviewed against the existing monorepo and Purchase Posting package conventions. This environment cannot execute the repository locally because direct network cloning is unavailable, so successful runtime/typecheck execution is not claimed here; the commands above are the required local verification for owner acceptance.

### Exit criteria

- [x] Independent Sales Posting package exists.
- [x] Durable Posting identity is explicit and separate from display/document numbering.
- [x] Company/Branch scope is explicit.
- [x] Durable Sales source identity and source version are explicit.
- [x] Sales Order is not accepted as a posting source.
- [x] Aggregate version/change timestamps are persistence-neutral and Bridge-ready.
- [x] Domain has no SQLite, PostgreSQL, UI or transport dependency.
- [x] Step-specific automated tests are present.
- [x] Step 3 remains owner of immutable Sales commercial posting inputs.

## Next Step

Step 3 — Commercial Posting Input from Immutable Sales Snapshots.

## Step 3 — Commercial Posting Input from Immutable Sales Snapshots

### Completed work

- Added `SalesCommercialPostingInput` as the Phase 25 boundary for consuming authoritative Phase 24 commercial facts.
- Phase 25 now depends on `@argin/sales` public contracts rather than duplicating Sales commercial models.
- Added `createSalesCommercialPostingInput()` to consume:
  - durable Sales source identity/version;
  - immutable `SalesDocumentSnapshot`;
  - immutable per-line `SalesCommercialSnapshot` facts;
  - authoritative `SalesDocumentTotals`.
- Preserved Company, Branch and Fiscal Year scope, Customer `partyId`, business date, currency, line/product identity, line classification, commercial terms and calculated Sales totals.
- Added source/document matching so a Posting source cannot point at another Sales document or a mismatched document type.
- Added line completeness validation: every Sales document line must have exactly one commercial snapshot; missing, duplicate or unknown line facts fail explicitly.
- Added immutable commercial snapshot verification through the Phase 24 `verifySalesCommercialSnapshot()` contract.
- Added exact document-total reconciliation against the supplied immutable line snapshots using integer-safe `BigInt` comparison.
- Preserved Phase 24 price origin, price-list revision lineage, discounts, charges, tax facts and line totals as upstream facts; Phase 25 does not re-run pricing policy.
- Preserved the boundary that Selling Price is commercial evidence only and is not Inventory cost or COGS.
- No Revenue/AR/VAT account mapping is introduced here; those remain Steps 4–6.
- No Journal balancing or Journal Voucher creation is introduced here; those remain Steps 7 and 24.
- No Inventory movement/valuation dependency is introduced here; those remain Steps 8–14.

### Commercial input contract

```text
Phase 24 Sales
  SalesDocumentSnapshot
  SalesCommercialSnapshot[]
  SalesDocumentTotals
          ↓
Phase 25
  SalesCommercialPostingInput
    source
    companyId
    branchId
    fiscalYearId
    customerPartyId
    businessDate
    currency
    lines[]
      snapshotId
      lineId
      productId
      lineKind
      capturedAt
      terms
      totals
    documentTotals
```

The Posting input is a provenance boundary, not a second editable source of Sales truth.

### Argin Bridge compliance

- Sales `documentId` and source version remain the authoritative upstream reference.
- Sales Posting does not replace them with local SQLite row IDs.
- Commercial snapshots retain immutable business provenance suitable for future replay/reconciliation across Argin Bridge.
- Display-oriented document number, customer name and product name are not used as business identity.
- Future synchronization may transport this provenance, but Step 3 adds no live transport or remote persistence.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-commercial-posting-input.test.ts
```

Coverage includes:

- creation from an authoritative Sales Invoice snapshot;
- mixed stock/service commercial facts;
- price/tax fact preservation without policy recomputation;
- source/document identity mismatch rejection;
- missing and duplicate commercial snapshot rejection;
- tampered line-total rejection;
- document-total mismatch rejection;
- Sales Order rejection as an accounting source.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm typecheck
pnpm test
```

### Validation note

The repository implementation and type contracts were reviewed against the current Phase 24 Sales public API. Successful local runtime/typecheck execution is not claimed from this environment; the commands above are the required owner-side executable verification.

### Exit criteria

- [x] Phase 25 consumes Phase 24 public Sales contracts instead of duplicating them.
- [x] Immutable line commercial facts are required and verified.
- [x] Source/document identity mismatch fails explicitly.
- [x] Every commercial document line has exactly one posting input snapshot.
- [x] Document totals reconcile exactly with the supplied line snapshots.
- [x] Price, discounts, charges and tax remain Sales-owned facts.
- [x] Selling price remains excluded from COGS authority.
- [x] No account resolution, Journal creation, Inventory valuation or UI responsibility leaked into Step 3.
- [x] Bridge-ready immutable provenance is preserved.

## Next Step

Step 4 — Revenue Account Resolution.

## Step 4 — Revenue Account Resolution

### Completed work

- Added the dedicated Sales Posting account role `sales-revenue`.
- Added `SalesRevenueAccountRule` as a persistence-neutral account-mapping contract.
- Added deterministic Revenue account selection with three mapping dimensions:
  - mandatory Company scope;
  - optional Branch scope;
  - optional Sales line classification: `stock-product`, `non-stock-product`, or `service`.
- A more specific rule always outranks a less-specific rule before numeric priority is considered.
- Numeric `priority` is used only between rules with equal specificity.
- Inactive rules and rules belonging to another Company are ignored.
- Missing mapping fails explicitly with `sales_posting.account_mapping_missing`; Phase 25 never silently selects or invents a Revenue account.
- Equally specific/equal-priority matches fail explicitly as `sales_posting.posting_rule_ambiguous`.
- Added `SalesPostingAccountReader` so account lookup remains behind an Application/persistence-neutral port.
- Revenue resolution verifies that the resolved Account:
  - exists;
  - belongs to the requested Company;
  - matches the mapped durable `accountId`;
  - is active;
  - allows direct posting.
- Missing, inactive or non-postable accounts fail closed.
- Product Master remains outside accounting ownership; Product/Service records do not carry the authoritative Revenue account.
- No Accounts Receivable or Output VAT role is introduced in this step; Steps 5–6 own those mappings.
- No accounting amount calculation is introduced in this step; Step 7 owns commercial debit/credit calculation and balancing.
- No generic Posting Rules platform is introduced; Phase 29 remains the owner of the general-purpose Posting Rules engine.

### Resolution model

```text
Sales commercial line
       ↓
companyId + branchId + lineKind
       ↓
Revenue mapping candidates
       ↓
specificity
  Branch + LineKind
  Branch
  LineKind
  Company default
       ↓
priority
       ↓
exactly one rule
       ↓
accountId
       ↓
active + postingAllowed Account
```

This supports, for example:

```text
stock-product      -> Sales Revenue - Goods
non-stock-product  -> Sales Revenue - Non-stock
service            -> Service Revenue
```

while still allowing a Company-wide default Revenue account where the accounting policy does not need separate classifications.

### Argin Bridge compliance

- Rules use durable `ruleId`, Company/Branch identity, line classification and durable Accounting `accountId`.
- Account code/name are returned only as account snapshots; they are not used as relational identity.
- No SQLite row identifier or server-specific persistence key leaks into the Domain contract.
- The resolver is deterministic, so the same authoritative rule set/context yields the same Revenue account on replay.
- Live Bridge transport remains deferred.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-revenue-account-resolution.test.ts
```

Coverage includes:

- most-specific Revenue mapping selection;
- service vs stock vs Company default mappings;
- specificity taking precedence over numeric priority;
- inactive-rule exclusion;
- Company-scope isolation;
- missing-mapping fail-closed behavior;
- ambiguous mapping rejection;
- active/postable Accounting account resolution;
- missing Account rejection;
- inactive Account rejection.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm typecheck
pnpm test
```

### Validation note

The implementation was reviewed against the existing Purchase Posting fail-closed account-resolution pattern while keeping Phase 25 ownership narrower. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain the executable owner-side acceptance evidence.

### Exit criteria

- [x] Sales Revenue has an explicit account role.
- [x] Resolution is Company-scoped and deterministic.
- [x] Branch-specific Revenue mapping is supported.
- [x] Goods/non-stock/service Revenue separation is supported without putting accounting ownership in Product Master.
- [x] Specificity outranks priority.
- [x] Missing and ambiguous mappings fail explicitly.
- [x] Resolved accounts must be active and postable.
- [x] Account identity is durable `accountId`, not code/name.
- [x] No AR/VAT/balancing/Journal responsibility leaked into Step 4.
- [x] Resolver remains persistence-neutral and Bridge-ready.

## Next Step

Step 5 — Accounts Receivable Account Resolution.

## Step 5 — Accounts Receivable Account Resolution

### Completed work

- Added the dedicated Sales Posting account role `accounts-receivable`.
- Added `SalesAccountsReceivableAccountRule` as the persistence-neutral AR control-account mapping contract.
- AR account selection is scoped by:
  - mandatory Company;
  - optional Branch override.
- Customer identity is explicitly carried as `customerPartyId`, but is not used to select a different control account per customer.
- This preserves the accounting architecture where:
  - the AR control account belongs to the Chart of Accounts/accounting policy;
  - the Customer remains a durable Party identity for detailed/subledger/Dimension provenance.
- Branch-specific AR mappings outrank the Company default.
- Priority is evaluated only between rules with equal specificity.
- Missing mapping fails closed with `sales_posting.account_mapping_missing`.
- Equally specific/equal-priority mappings fail with `sales_posting.posting_rule_ambiguous`.
- Inactive and cross-company mappings are ignored.
- Resolution uses the existing persistence-neutral `SalesPostingAccountReader`.
- Resolved AR accounts must:
  - exist;
  - match the mapped durable `accountId`;
  - belong to the requested Company;
  - be active;
  - allow direct posting.
- Missing, wrong-company, inactive or non-postable accounts fail explicitly.
- No customer-specific Chart-of-Accounts account is created or inferred in this step.
- No Customer Dimension materialization or Journal-line dimension assignment is implemented here; this step only preserves the durable `customerPartyId` needed by downstream posting/provenance.
- Output VAT remains Step 6.
- Debit/Credit amount calculation and balancing remain Step 7.
- Journal Voucher creation remains Step 24.

### Resolution model

```text
Sales commercial document
        ↓
companyId + branchId + customerPartyId
        ↓
AR mapping candidates
        ↓
Branch-specific rule
        ↓
Company default rule
        ↓
Accounts Receivable control account
        +
customerPartyId provenance
```

Example:

```text
Accounts Receivable Control Account = 1201

Customer A -> PARTY(customer-a)
Customer B -> PARTY(customer-b)
Customer C -> PARTY(customer-c)
```

The customers do not require three separate control accounts. Their durable Party identities remain available for subsidiary/detail accounting while the AR control account remains governed centrally.

### Argin Bridge compliance

- Rules use durable `ruleId`, Company/Branch identity and durable Accounting `accountId`.
- Customer provenance uses durable `customerPartyId`.
- Account code/name remain descriptive snapshot data rather than identity.
- No local SQLite row ID is used.
- Resolution is deterministic under the same rule set/context.
- Live Bridge synchronization remains deferred.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-accounts-receivable-resolution.test.ts
```

Coverage includes:

- Branch-specific AR override;
- Company-default AR mapping;
- Customer identity not altering the control-account mapping;
- priority within equal specificity;
- missing mapping fail-closed behavior;
- ambiguous mapping rejection;
- required Customer Party identity;
- active/postable account resolution;
- preservation of `customerPartyId`;
- missing account rejection;
- wrong-company account rejection;
- inactive account rejection;
- non-postable account rejection.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm typecheck
pnpm test
```

### Validation note

The implementation follows the existing Purchase Posting control-account pattern while preserving Customer Party identity separately from the AR control account. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain the owner-side executable validation.

### Exit criteria

- [x] Accounts Receivable has an explicit Sales Posting role.
- [x] Company-level AR mapping is supported.
- [x] Branch-specific AR override is supported.
- [x] Customer Party identity is required and preserved.
- [x] Customer identity does not create or select a separate AR control account.
- [x] Missing/ambiguous mappings fail explicitly.
- [x] Resolved AR account must be active, postable and Company-correct.
- [x] Durable `accountId` is used instead of code/name identity.
- [x] No VAT/calculation/Journal responsibility leaked into Step 5.
- [x] Resolver remains persistence-neutral and Bridge-ready.

## Next Step

Step 6 — Output VAT Account Resolution.

## Step 6 — Output VAT Account Resolution

### Completed work

- Added the dedicated Sales Posting account role `output-vat`.
- Added `SalesOutputVatAccountRule` as the persistence-neutral Output VAT mapping contract.
- Output VAT account selection is scoped by:
  - mandatory Company;
  - optional Branch override;
  - optional Sales `taxCode` specialization.
- Phase 25 consumes Phase 24 tax facts exactly as upstream commercial evidence:
  - `taxId`;
  - `taxCode`;
  - `rateBasisPoints`.
- `taxCode` is normalized only for deterministic matching; `rateBasisPoints` is preserved and never recomputed by Step 6.
- A Branch + taxCode rule outranks Branch-only/taxCode-only/Company-default mappings.
- Specificity outranks numeric priority.
- Priority is evaluated only between equally specific rules.
- Missing mapping fails closed with `sales_posting.account_mapping_missing`.
- Equally specific/equal-priority mappings fail with `sales_posting.posting_rule_ambiguous`.
- Inactive and cross-company mappings are ignored.
- Resolved VAT accounts must:
  - exist;
  - match the mapped durable `accountId`;
  - belong to the requested Company;
  - be active;
  - allow direct posting.
- Missing, wrong-company, inactive or non-postable accounts fail explicitly.
- No VAT amount calculation is implemented here; Step 7 owns commercial debit/credit amount construction and balancing.
- No tax policy/re-rate logic is introduced; Sales remains owner of the authoritative commercial tax facts.
- No Journal Voucher creation is introduced; Step 24 remains the Journal creation boundary.

### Resolution model

```text
Phase 24 SalesTax fact
  taxId
  taxCode
  rateBasisPoints
        ↓
Company + Branch + taxCode
        ↓
Output VAT mapping candidates
        ↓
Most-specific rule
        ↓
Output VAT account
```

Example:

```text
Company default VAT
  -> Output VAT Control

taxCode = VAT
  -> Output VAT Standard

Branch A + taxCode = VAT
  -> Branch A Output VAT
```

The authoritative tax percentage itself remains the Sales fact. The mapping resolves only the Accounting account.

### Argin Bridge compliance

- Rules use durable `ruleId`, Company/Branch identity, normalized tax-code key and durable `accountId`.
- The upstream `taxId` is preserved as immutable provenance.
- Account code/name remain descriptive snapshots, not identity.
- No SQLite row identity enters the Domain contract.
- Resolution is deterministic for the same rule set and tax context.
- Live Bridge transport remains deferred.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-output-vat-account-resolution.test.ts
```

Coverage includes:

- Branch + taxCode most-specific resolution;
- taxCode-specific fallback;
- Company-default fallback;
- deterministic tax-code normalization;
- preservation of authoritative tax rate;
- specificity before priority;
- missing mapping fail-closed behavior;
- ambiguous mapping rejection;
- required `taxId`;
- tax-rate shape validation;
- missing account rejection;
- wrong-company account rejection;
- inactive account rejection;
- non-postable account rejection.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

The implementation was reviewed against the existing Purchase Posting account-resolution pattern and the actual Phase 24 `SalesTax` contract. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain the owner-side executable acceptance evidence.

### Exit criteria

- [x] Output VAT has an explicit Sales Posting role.
- [x] Company-level Output VAT mapping is supported.
- [x] Branch-specific override is supported.
- [x] taxCode-specific mapping is supported.
- [x] Phase 24 `taxId/taxCode/rateBasisPoints` provenance is preserved.
- [x] Step 6 does not recalculate VAT rate or amount.
- [x] Missing/ambiguous mappings fail explicitly.
- [x] Resolved VAT account must be active, postable and Company-correct.
- [x] Durable `accountId` is used rather than code/name identity.
- [x] No balancing/Journal responsibility leaked into Step 6.
- [x] Resolver remains persistence-neutral and Bridge-ready.

## Next Step

Step 7 — Commercial Posting Calculation & Balancing.

## Step 7 — Commercial Posting Calculation & Balancing

### Completed work

- Added `calculateSalesCommercialPosting()` to convert immutable Sales commercial facts plus the resolved Step 4–6 accounts into deterministic commercial accounting components.
- The commercial accounting equation is now frozen as:

```text
Accounts Receivable    Dr = grandTotal
    Sales Revenue          Cr = taxBaseAmount
    Output VAT             Cr = taxAmount
```

- Revenue is calculated per Sales line from the authoritative Phase 24 `taxBaseAmount`.
- Output VAT is calculated per taxed Sales line from the authoritative Phase 24 `taxAmount`.
- Accounts Receivable uses authoritative document `grandTotal`.
- Step 7 never recalculates tax rates, tax bases, discounts, charges or selling prices; all monetary values are consumed from the immutable Step 3 input.
- Every Sales line must have exactly one compatible Revenue account resolution.
- Taxed lines must have Output VAT resolutions covering every immutable Sales tax fact.
- Tax resolution provenance is validated against the exact upstream `taxId`, `taxCode` and `rateBasisPoints`.
- Multiple tax facts on one Sales line are supported without recalculating their individual amounts when all resolve to the same Output VAT account; their tax IDs/codes remain attached to the resulting aggregate VAT component.
- If multiple tax facts on one line resolve to different Output VAT accounts, Step 7 fails closed because Phase 24 currently exposes only the authoritative aggregate line `taxAmount`, not immutable per-tax monetary allocations. Phase 25 will not invent a split.
- Zero-tax lines generate no synthetic VAT component.
- AR resolution must match the same Company and Customer Party as the commercial input.
- Revenue/VAT account resolutions must belong to the same Company and match the line/tax provenance.
- All money arithmetic and balance controls use safe-integer / `BigInt` accumulation.
- Added explicit balance assertions:
  - total Debit = total Credit;
  - total Debit = document `grandTotal`;
  - total Revenue = document `taxBaseAmount`;
  - total VAT = document `taxAmount`;
  - Revenue + VAT = AR.
- Commercial components retain durable Sales line, Customer Party and tax provenance for later Journal construction.
- No COGS or Inventory component is introduced here. Stock cost remains owned by Steps 8–14 and Phase 21 actual valuation.
- No Journal Voucher or Journal Line is created. Step 24 remains the Journal creation boundary.

### Calculation model

```text
Immutable Sales Commercial Input
            +
Resolved Revenue Accounts
            +
Resolved AR Control Account
            +
Resolved Output VAT Accounts
            ↓
Commercial Posting Calculation
            ↓
AR Debit
Revenue Credit(s)
Output VAT Credit(s)
            ↓
Balance Control
Debit == Credit
```

Example:

```text
Goods revenue base       2,000,000
Service revenue base       500,000
Output VAT                  50,000
----------------------------------
Accounts Receivable      2,550,000

Dr Accounts Receivable   2,550,000
    Cr Goods Revenue     2,000,000
    Cr Service Revenue     500,000
    Cr Output VAT           50,000
```

This is only the commercial leg. A stock sale may later add:

```text
Dr COGS
    Cr Inventory
```

from authoritative Phase 21 outbound valuation; that cost leg is deliberately absent from Step 7.

### Argin Bridge compliance

- Components use durable account IDs, Sales source line IDs, Customer Party ID and Sales tax IDs/codes.
- Commercial amounts remain derived deterministically from immutable synchronized Sales facts.
- No SQLite row identity or UI/display identifier becomes accounting identity.
- The same immutable facts and resolved mappings produce the same commercial component set.
- Live Bridge transport remains deferred.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-commercial-posting-calculation.test.ts
```

Coverage includes:

- balanced AR / Revenue / Output VAT construction;
- mixed stock + service commercial posting;
- exact Revenue/VAT/AR monetary reconciliation;
- zero-tax invoices;
- Customer/Company AR resolution mismatch;
- missing Revenue mapping;
- Revenue line-kind mismatch;
- missing/duplicate/mismatched VAT provenance;
- multi-tax provenance with one aggregate VAT account;
- fail-closed behavior when one aggregate tax amount would need splitting across different accounts;
- explicit proof that Step 7 creates no COGS/Inventory components.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

The implementation was structurally reviewed against the immutable Phase 24 Sales pricing/tax contracts and the Phase 23 Purchase Posting separation between calculation components and Journal creation. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain the owner-side executable acceptance evidence.

### Exit criteria

- [x] AR debit equals authoritative Sales `grandTotal`.
- [x] Revenue credit uses authoritative `taxBaseAmount`.
- [x] Output VAT credit uses authoritative `taxAmount`.
- [x] Debit and Credit reconcile exactly.
- [x] Sales pricing and tax rates are not recalculated.
- [x] Revenue resolution is complete for every Sales line.
- [x] VAT resolution preserves immutable tax provenance.
- [x] Zero-tax lines do not create synthetic VAT entries.
- [x] Unsupported per-tax monetary splitting fails closed instead of being guessed.
- [x] Customer Party and Sales line provenance are preserved.
- [x] COGS/Inventory remain excluded from the commercial leg.
- [x] Journal Voucher creation remains deferred to Step 24.
- [x] Calculation remains persistence-neutral and Bridge-ready.

## Next Step

Step 8 — Stock-Fulfillment Prerequisite Contract.

## Step 8 — Stock-Fulfillment Prerequisite Contract

### Completed work

- Added the persistence-neutral stock-fulfillment gate that separates commercial posting from Inventory cost eligibility.
- Added `SalesStockFulfillmentEvidence` for durable Inventory Issue evidence without importing mutable stock balances or valuation amounts into Sales Posting.
- Stock lines require exact lineage to:
  - the same Company;
  - Sales source system;
  - `sales-invoice` source document type;
  - the same Sales Invoice durable ID;
  - the exact Sales line ID;
  - the exact Product ID;
  - durable Inventory Issue document and line IDs.
- Added line-level prerequisite states:
  - `waiting-for-issue`;
  - `waiting-for-confirmation`;
  - `eligible`;
  - `not-required`.
- A stock line becomes COGS-eligible only when its Inventory Issue evidence is `confirmed`.
- Draft, Submitted, Approved, Cancelled or Reversed Inventory Issue evidence never satisfies the stock-cost prerequisite.
- Missing Issue evidence blocks COGS and reports `waiting-for-issue`.
- Service and non-stock lines never require Inventory fulfillment solely because they are sold and are marked `not-required`.
- Service-only invoices therefore bypass this Inventory prerequisite completely.
- Mixed invoices evaluate the prerequisite only for stock lines.
- Inventory evidence attached to a service/non-stock Sales line is rejected as a lineage error instead of being silently consumed.
- Duplicate, unknown-line, cross-company, wrong-document or wrong-product evidence is rejected fail-closed.
- Added `assertSalesStockFulfillmentEligible()` as an explicit guard before downstream cost-posting work.
- The prerequisite result deliberately contains no selling price, unit price, cost quote, COGS or valuation amount.
- Step 8 does not resolve the authoritative Inventory Issue object itself; Step 9 owns Issue Lineage Resolution.
- Step 8 does not resolve Inventory Movement; Step 10 owns Movement Lineage Resolution.
- Step 8 does not consume FIFO/MWA valuation; Step 11 owns the Valuation prerequisite.

### Prerequisite model

```text
Sales commercial line
        |
        +-- service/non-stock
        |      -> Inventory prerequisite not required
        |
        +-- stock-product
               ↓
        Inventory Issue exists?
               |
          no -> waiting-for-issue
               |
          yes
               ↓
        exact Sales/Company/Product lineage?
               |
          no -> fail closed
               |
          yes
               ↓
        Inventory Issue confirmed?
               |
          no -> waiting-for-confirmation
               |
          yes -> eligible for Step 9/10/11 cost lineage
```

This step only opens the door to cost posting. It does not yet prove Movement or Valuation readiness.

### Argin Bridge compliance

- Durable Sales document/line IDs and Inventory document/line IDs form the prerequisite provenance.
- Company identity is validated explicitly across boundaries.
- No SQLite row IDs, stock-balance projections or UI identifiers are used.
- No monetary Sales facts are copied into Inventory fulfillment evidence.
- The same immutable evidence produces the same prerequisite state.
- Live Bridge transport remains deferred.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-stock-fulfillment-prerequisite.test.ts
```

Coverage includes:

- missing Issue -> waiting-for-issue;
- Approved but unconfirmed Issue -> waiting-for-confirmation;
- Confirmed Issue -> eligible;
- explicit COGS guard rejection while blocked;
- service-only Invoice bypass;
- mixed stock/service behavior;
- rejection of Inventory evidence on non-stock/service lines;
- cross-company/source-document/product lineage mismatch rejection;
- duplicate/unknown-line evidence rejection;
- explicit proof that the prerequisite contract contains no selling-price/COGS data.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm typecheck
pnpm test
```

### Validation note

The implementation was reviewed against the canonical Phase 24 -> Phase 25 Sales Fulfillment handoff and the actual Inventory lifecycle contract where only `confirmed` makes quantity effects authoritative. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain owner-side executable evidence.

### Exit criteria

- [x] Stock lines require Inventory Issue evidence.
- [x] Only confirmed Issue evidence makes the stock prerequisite eligible.
- [x] Missing/unconfirmed fulfillment blocks COGS.
- [x] Service/non-stock lines bypass Inventory fulfillment.
- [x] Mixed invoices wait only on stock-line prerequisites.
- [x] Company/Sales document/Sales line/Product lineage is validated.
- [x] Inventory evidence on non-stock lines is rejected.
- [x] No selling-price/cost-quote data enters the prerequisite contract.
- [x] Issue/Movement/Valuation resolution remains deferred to Steps 9–11.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 9 — Inventory Issue Lineage Resolution.

## Step 9 — Inventory Issue Lineage Resolution

### Completed work

- Added `resolveSalesInventoryIssueLineage()` to resolve the actual confirmed Inventory Issue behind each stock Sales line.
- Resolution uses the Inventory document repository contract through the persistence-neutral `SalesInventoryIssueDocumentReader`; Sales Posting does not read SQLite directly.
- The resolver starts only from a Step 8 prerequisite result that is already COGS-eligible.
- Every stock line must resolve to an Inventory document that is:
  - in the same Company;
  - `documentType = issue`;
  - `status = confirmed`;
  - sourced from `sales`;
  - sourced from `sales-invoice`;
  - sourced from the same durable Sales Invoice ID.
- Inventory document-level source reference must remain document-scoped (`lineId = null`).
- Exact Sales-line lineage is resolved through each Inventory line's immutable `sourceReference.lineId`.
- Sales Posting deliberately does not assume `InventoryLineId == SalesLineId`; Inventory owns its own durable line identity.
- Product identity must match between the Sales stock line and the resolved Inventory Issue line.
- Missing matching Inventory line fails as `inventory_issue_lineage_missing`.
- Multiple Inventory lines claiming the same Sales line fail as `inventory_issue_lineage_ambiguous`.
- Prerequisite `inventoryLineId` must match the actual resolved Inventory line.
- Duplicate reuse of one Inventory line by multiple Sales stock lines is rejected.
- The resulting lineage preserves:
  - Sales line ID;
  - Product ID;
  - Inventory Issue document ID;
  - Inventory document version;
  - Inventory Issue line ID;
  - authoritative confirmation timestamp.
- Service-only Sales documents return an empty Issue-lineage set and do not invoke Inventory lookup.
- No Stock Movement is resolved here; Step 10 owns the Movement lineage.
- No FIFO/MWA amount is resolved here; Step 11 owns valuation readiness.
- No COGS amount is created here.

### Lineage model

```text
Sales stock line
  salesLineId
  productId
       ↓
Step 8 eligible prerequisite
  inventoryDocumentId
  inventoryLineId
       ↓
Load authoritative Inventory Issue
       ↓
Issue:
  same Company
  type = issue
  status = confirmed
  source = sales / sales-invoice / same invoice
       ↓
Inventory line sourceReference
  documentId = same Sales Invoice
  lineId = exact Sales line
       ↓
Resolved Issue Lineage
```

Important:

```text
SalesLineId != InventoryLineId
```

They are related through immutable source lineage, not identity equality.

### Argin Bridge compliance

- Sales document/line identity and Inventory document/line identity remain independent durable identities.
- Cross-module linkage uses explicit immutable source references.
- Inventory document version is preserved for later replay/concurrency/provenance use.
- Confirmation time is retained as business lineage evidence.
- No SQLite row ID or display/document number is used for linkage.
- No monetary Sales or Inventory valuation amount enters Step 9.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-inventory-issue-lineage.test.ts
```

Coverage includes:

- successful confirmed Issue resolution;
- exact Sales line -> Inventory sourceReference matching;
- service-only bypass;
- missing Inventory document;
- wrong Inventory document type;
- non-confirmed Inventory document;
- cross-company Issue rejection;
- wrong Sales source document rejection;
- missing line source lineage;
- ambiguous duplicate line source lineage;
- Product mismatch;
- Step 8 prerequisite Inventory-line mismatch;
- blocked prerequisite rejection.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm typecheck
pnpm test
```

### Validation note

The implementation was reviewed against the actual Phase 24 Sales -> Inventory staging composition, where Inventory creates its own line ID and stores the originating Sales line in `sourceReference.lineId`. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain owner-side executable validation.

### Exit criteria

- [x] Actual Inventory Issue document is resolved through a persistence-neutral reader.
- [x] Only confirmed Issue documents are accepted.
- [x] Company and Sales document source lineage are exact.
- [x] Sales line lineage is resolved through Inventory line source references.
- [x] Inventory line identity remains independent from Sales line identity.
- [x] Product identity must match.
- [x] Missing/ambiguous line lineage fails closed.
- [x] Step 8 prerequisite IDs must agree with authoritative Inventory facts.
- [x] Service-only documents bypass Issue resolution.
- [x] No Movement/Valuation/COGS responsibility leaked into Step 9.
- [x] Durable provenance remains Bridge-ready.

## Next Step

Step 10 — Outbound Inventory Movement Lineage Resolution.

## Step 10 — Outbound Inventory Movement Lineage Resolution

### Completed work

- Added `resolveSalesOutboundInventoryMovementLineage()` to resolve the authoritative stock movement created by each confirmed Inventory Issue line.
- Added the persistence-neutral `SalesInventoryMovementReader` contract; Sales Posting does not query SQLite movement tables directly.
- Movement lookup is performed by Inventory Issue document and then narrowed to the exact Inventory Issue line from Step 9.
- Exactly one movement must exist for every resolved stock Issue line.
- The movement must match:
  - Company;
  - Inventory Issue document ID;
  - Inventory Issue line ID;
  - Product ID;
  - Sales business date;
  - Issue confirmation timestamp.
- Inventory Issue movement direction must be outbound: `quantityDelta < 0`.
- Zero or positive movement quantity is rejected.
- Issue movements used for Sales COGS must not be transfer movements.
- Issue movements used for Sales COGS must not themselves be reversal movements.
- Ambiguous multiple movements for one Inventory Issue line fail closed.
- Duplicate reuse of one Movement ID across multiple lineage entries fails closed.
- Resolved movement lineage preserves:
  - Sales line ID;
  - Product ID;
  - Inventory Issue document ID;
  - Inventory Issue line ID;
  - durable Movement ID;
  - business date/order;
  - recorded timestamp;
  - exact signed quantity delta;
  - Warehouse/Zone/Location identity.
- Service-only/no-stock lineage returns an empty movement set without invoking the movement reader.
- No Inventory balance projection is used; immutable Movement facts remain authoritative.
- No FIFO/MWA cost or valuation amount is introduced in Step 10; Step 11 remains the sole valuation prerequisite.

### Lineage model

```text
Sales stock line
      ↓
Confirmed Inventory Issue line (Step 9)
      ↓
Inventory Movement repository
      ↓
exact documentId + lineId
      ↓
exactly one immutable Movement
      ↓
company/product/date/time validation
      ↓
quantityDelta < 0
transferId = null
reversalOfMovementId = null
      ↓
Resolved Outbound Movement Lineage
```

Important separation:

```text
Sales selling quantity/price
        !=
Inventory valuation amount
```

Step 10 consumes quantity Movement facts only. It does not infer cost from price or quantity.

### Argin Bridge compliance

- Durable Movement ID is preserved as downstream valuation provenance.
- Inventory document/line and Sales line identities remain independently durable.
- Warehouse/Zone/Location provenance is retained.
- Business chronology (`businessDate`, `businessOrder`, `recordedAt`) is preserved.
- No balance projection, SQLite row ID or UI identifier is used as authoritative lineage.
- No valuation amount is duplicated into this contract.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-inventory-movement-lineage.test.ts
```

Coverage includes:

- exact outbound Movement resolution;
- durable Movement/Warehouse provenance;
- empty no-stock path;
- missing Movement;
- ambiguous multiple Movements;
- positive/inbound quantity rejection;
- Product mismatch;
- business-date mismatch;
- confirmation-time mismatch;
- Transfer movement rejection;
- reversal movement rejection;
- cross-company/source lineage rejection;
- explicit proof that no valuation/cost amount is introduced.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm typecheck
pnpm test
```

### Validation note

The implementation was reviewed against the Inventory confirmation workflow, where an Issue creates one immutable negative-quantity Stock Movement per Inventory line using the same confirmation action timestamp. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain owner-side executable validation.

### Exit criteria

- [x] Authoritative Movement is resolved through a persistence-neutral reader.
- [x] Movement must match exact Issue document and line.
- [x] Movement Company/Product lineage is exact.
- [x] Only outbound negative quantity is accepted.
- [x] Transfer/reversal movement facts are excluded.
- [x] Business chronology is preserved.
- [x] Missing/ambiguous movement lineage fails closed.
- [x] Service-only/no-stock path bypasses movement lookup.
- [x] No balance projection is treated as authoritative.
- [x] No valuation/COGS amount leaked into Step 10.
- [x] Durable Movement provenance remains Bridge-ready.

## Next Step

Step 11 — Resolved FIFO/MWA Valuation Prerequisite.

## Step 11 — Resolved FIFO/MWA Valuation Prerequisite

### Completed work

- Added `resolveSalesResolvedValuationPrerequisite()` to bind each outbound Movement from Step 10 to the authoritative Phase 21 valuation entry.
- Reused the existing persistence-neutral `InventoryValuationEntryRepository.findByMovement()` contract instead of adding Sales-specific SQLite access.
- Every stock Movement must resolve to exactly one valuation entry for the same durable `movementId`.
- The valuation entry must match:
  - Company;
  - Product;
  - Inventory Issue document ID;
  - Inventory Issue line ID;
  - Movement ID;
  - Warehouse/Zone/Location StockKey;
  - business date;
  - business order.
- Only `kind = outbound` valuation entries are accepted.
- Transfer and reversal valuation sources are rejected for the normal Sales Invoice COGS path.
- Both supported Phase 21 valuation methods are accepted:
  - `fifo`;
  - `moving_average`.
- The valuation must have `costState = resolved`.
- A resolved valuation must provide:
  - `unitCost`;
  - `totalCost`;
  - `valuedAt`;
  - null `unresolvedReason`.
- Missing valuation fails with `valuation_prerequisite_missing`.
- Unresolved valuation fails with `valuation_prerequisite_unresolved`.
- Cross-lineage/method/source inconsistencies fail closed with `valuation_prerequisite_invalid`.
- Outbound valuation `totalCost` is preserved with its authoritative Phase 21 sign convention; positive outbound total cost is rejected.
- The result preserves:
  - Sales line ID;
  - Product ID;
  - Movement ID;
  - Valuation Entry ID;
  - valuation method;
  - strategy version;
  - currency;
  - valued quantity;
  - unit cost;
  - signed total cost;
  - valued timestamp;
  - valuation revision.
- Service-only/no-stock movement lineage bypasses valuation lookup and is immediately ready with an empty valuation set.
- No account resolution is introduced here; COGS and Inventory accounts remain Steps 12–13.
- No Debit/Credit or Journal component is created here; Step 14 owns the COGS / Inventory Relief calculation.

### Prerequisite model

```text
Outbound Inventory Movement (Step 10)
        ↓
InventoryValuationEntryRepository
        ↓
findByMovement(companyId, movementId)
        ↓
Valuation exists?
   no -> blocked / missing
        ↓
costState = resolved?
   no -> blocked / unresolved
        ↓
kind = outbound
source/document/line/product/stockKey exact
        ↓
method = FIFO or Moving Average
        ↓
Resolved Valuation Prerequisite
```

Critical authority rule:

```text
Sales selling price
    !=
Phase 24 pre-finalization cost quote
    !=
Phase 21 resolved valuation cost

COGS authority = Phase 21 resolved outbound valuation only
```

### Argin Bridge compliance

- Durable `movementId` is the authoritative cross-module join key.
- Durable `valuationEntryId`, `revision`, `strategyVersion` and `valuedAt` are preserved for replay/audit provenance.
- Sales Posting consumes the valuation contract rather than copying Inventory persistence behavior.
- StockKey identity is validated but no balance projection is used.
- No SQLite row ID, display code or mutable Product/Sales price is used as valuation identity.
- Future remote Bridge replay can verify the exact valuation revision consumed by accounting.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-resolved-valuation-prerequisite.test.ts
```

Coverage includes:

- resolved FIFO valuation;
- resolved Moving Average valuation;
- service-only/no-stock bypass;
- missing valuation;
- unresolved valuation;
- Movement ID mismatch;
- document/line mismatch;
- Product mismatch;
- Warehouse/StockKey mismatch;
- non-outbound valuation rejection;
- Transfer/Reversal valuation rejection;
- positive outbound cost rejection;
- preservation of strategy version, valuation revision and valued timestamp;
- explicit proof that no account/debit/credit responsibility leaks into Step 11.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm typecheck
pnpm test
```

### Validation note

The implementation was reviewed against the actual Phase 21 Inventory valuation domain and the existing `InventoryValuationEntryRepository.findByMovement()` persistence contract. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain owner-side executable validation.

### Exit criteria

- [x] Every stock Movement resolves through durable Movement identity.
- [x] Missing valuation blocks cost posting.
- [x] Unresolved valuation blocks cost posting.
- [x] FIFO and Moving Average are both supported.
- [x] Only outbound valuation entries are accepted.
- [x] Company/Product/Document/Line/StockKey chronology is validated.
- [x] Transfer/Reversal valuation sources are excluded from the normal Sales Invoice path.
- [x] Signed Phase 21 total cost is preserved without reinterpretation.
- [x] Strategy/revision/valued-at provenance is preserved.
- [x] Service-only/no-stock path bypasses valuation lookup.
- [x] No COGS/Inventory account or Debit/Credit responsibility leaked into Step 11.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 12 — COGS Account Resolution.

## Step 12 — COGS Account Resolution

### Completed work

- Added the explicit Sales Posting account role `cogs`.
- Added `SalesCogsAccountRule` as the persistence-neutral COGS mapping contract.
- COGS account selection is scoped by:
  - mandatory Company;
  - optional Branch override.
- Branch-specific mapping outranks Company default mapping.
- Priority is evaluated only between equally specific rules.
- Equal-specificity/equal-priority rules fail as ambiguous.
- Missing mapping fails closed with `sales_posting.account_mapping_missing`.
- Added `SalesCogsAccountResolutionContext` preserving the stock-cost provenance that caused the resolution:
  - Sales line ID;
  - Product ID;
  - Phase 21 Valuation Entry ID.
- The valuation method (`fifo` / `moving_average`) deliberately does not participate in account selection; valuation method determines cost amount, not GL account identity.
- Valuation `unitCost` / `totalCost` deliberately do not participate in account selection.
- Product Master does not own the COGS GL account mapping in Step 12.
- Resolved accounts must:
  - exist;
  - match the configured durable `accountId`;
  - belong to the requested Company;
  - be active;
  - allow posting.
- Missing, cross-company, inactive and non-postable accounts fail explicitly.
- Account code/name are descriptive snapshots only and are not used as durable identity.
- No COGS amount is calculated in Step 12.
- No Debit/Credit component is created in Step 12.
- Step 13 remains responsible for Inventory account resolution.
- Step 14 remains responsible for converting authoritative signed valuation cost into balanced COGS/Inventory Relief components.

### Resolution model

```text
Resolved Phase 21 valuation lineage
  salesLineId
  productId
  valuationEntryId
        ↓
Company + Branch
        ↓
COGS mapping candidates
        ↓
Most-specific rule
        ↓
COGS GL account
```

Accounting separation:

```text
Valuation method / amount -> determines cost value
COGS mapping             -> determines GL destination

These are independent concerns.
```

### Argin Bridge compliance

- Durable `ruleId`, Company/Branch identity and durable `accountId` are used.
- Sales line, Product and Valuation Entry IDs are preserved as provenance.
- Account code/name remain non-authoritative display fields.
- No SQLite row identity, UI identifier or valuation method becomes account identity.
- The same mapping context resolves deterministically.
- Live Bridge transport remains deferred.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-cogs-account-resolution.test.ts
```

Coverage includes:

- Branch-specific rule outranking Company default;
- Company default fallback;
- priority only between equal-specificity rules;
- missing mapping fail-closed behavior;
- ambiguous mapping rejection;
- required Sales line/Product/Valuation Entry provenance;
- active/postable account resolution;
- provenance preservation;
- missing account rejection;
- cross-company account rejection;
- inactive account rejection;
- non-postable account rejection;
- explicit proof that valuation method and valuation amount do not participate in COGS account selection.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

The implementation follows the existing Sales Posting account-resolution pattern while preserving the Phase 21 authority boundary: valuation determines cost, account mapping determines ledger destination. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain owner-side executable validation.

### Exit criteria

- [x] COGS has an explicit Sales Posting account role.
- [x] Company-level mapping is supported.
- [x] Branch override is supported.
- [x] Missing/ambiguous mappings fail explicitly.
- [x] Resolved account must be active, postable and Company-correct.
- [x] Stock Sales line, Product and Valuation Entry provenance are preserved.
- [x] FIFO/MWA method does not alter GL account selection.
- [x] Valuation amount does not alter GL account selection.
- [x] Product Master does not own the COGS account mapping.
- [x] No cost calculation or Journal component leaked into Step 12.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 13 — Inventory Account Resolution.

## Step 13 — Inventory Account Resolution

### Completed work

- Added the explicit Sales Posting account role `inventory-asset`.
- Added `SalesInventoryAccountRule` as the persistence-neutral Inventory GL mapping contract.
- Inventory account selection is scoped by:
  - mandatory Company;
  - optional Branch override.
- Branch-specific mapping outranks Company default mapping.
- Priority is evaluated only between equally specific rules.
- Equal-specificity/equal-priority rules fail as ambiguous.
- Missing mapping fails closed with `sales_posting.account_mapping_missing`.
- Added `SalesInventoryAccountResolutionContext` preserving the exact stock-cost provenance that caused resolution:
  - Sales line ID;
  - Product ID;
  - outbound Movement ID;
  - Phase 21 Valuation Entry ID;
  - Warehouse ID.
- Warehouse/Movement/Valuation identity is provenance only and does not silently become a new account-mapping dimension in Phase 25.
- Product Master does not own Inventory GL account mapping.
- Warehouse Master does not own Inventory GL account mapping.
- Resolved accounts must:
  - exist;
  - match the configured durable `accountId`;
  - belong to the requested Company;
  - be active;
  - allow posting.
- Missing, cross-company, inactive and non-postable accounts fail explicitly.
- Account code/name remain display snapshots only.
- No inventory relief amount is calculated in Step 13.
- No Credit component is created in Step 13.
- Step 14 remains responsible for combining the COGS account from Step 12, Inventory account from Step 13 and resolved valuation amount from Step 11 into balanced COGS / Inventory Relief components.

### Resolution model

```text
Resolved stock lineage
  salesLineId
  productId
  movementId
  valuationEntryId
  warehouseId
        ↓
Company + Branch
        ↓
Inventory Asset mapping
        ↓
Inventory GL account
```

Accounting separation:

```text
Movement / Valuation / Warehouse -> provenance
Company / Branch mapping         -> GL destination
Phase 21 valuation               -> monetary cost
```

### Argin Bridge compliance

- Durable Sales line, Product, Movement, Valuation Entry and Warehouse IDs are preserved.
- Durable `ruleId` and `accountId` determine the accounting mapping.
- Account code/name remain non-authoritative display fields.
- No SQLite row identity or UI selection becomes accounting identity.
- No mutable Product or Warehouse master field owns historical GL mapping.
- Future Posting Rules can extend mapping dimensions without rewriting the Phase 21 valuation authority boundary.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-inventory-account-resolution.test.ts
```

Coverage includes:

- Branch-specific Inventory mapping outranking Company default;
- Company default fallback;
- priority between equal-specificity rules;
- missing mapping fail-closed behavior;
- ambiguous mapping rejection;
- required Sales line/Product/Movement/Valuation/Warehouse provenance;
- active/postable account resolution;
- provenance preservation;
- missing account rejection;
- cross-company account rejection;
- inactive account rejection;
- non-postable account rejection;
- explicit proof that Warehouse/Movement/Valuation facts remain provenance and do not silently become account-selection dimensions.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

The implementation follows the existing Purchase Posting `inventory-asset` role and the Sales Posting Step 12 account-resolution pattern while preserving Inventory/Valuation ownership. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain owner-side executable validation.

### Exit criteria

- [x] Inventory Asset has an explicit Sales Posting account role.
- [x] Company-level mapping is supported.
- [x] Branch override is supported.
- [x] Missing/ambiguous mappings fail explicitly.
- [x] Resolved account must be active, postable and Company-correct.
- [x] Sales line/Product/Movement/Valuation/Warehouse provenance is preserved.
- [x] Warehouse/Product masters do not own the GL mapping.
- [x] Warehouse/Valuation facts do not silently become mapping dimensions.
- [x] No monetary calculation or Journal component leaked into Step 13.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 14 — COGS / Inventory Relief Posting Calculation.

## Step 14 — COGS / Inventory Relief Posting Calculation

### Completed work

- Added `calculateSalesCostPosting()` to convert resolved Phase 21 outbound valuation facts plus Step 12/13 account resolutions into deterministic Sales cost-posting components.
- The authoritative monetary input is `valuation.totalCost` from Step 11.
- Phase 21 outbound valuation keeps its signed convention; Step 14 converts the absolute value into accounting amount without recalculating cost.
- For each non-zero stock valuation line, Step 14 creates exactly two accounting components:

```text
COGS             Debit
Inventory Asset  Credit
```

- Debit and Credit amounts are identical and equal to the absolute authoritative outbound valuation total.
- FIFO and Moving Average produce the same accounting direction; only the authoritative valuation amount/method provenance differs.
- Zero resolved valuation cost produces no synthetic zero-value accounting components.
- Service-only/no-stock valuation input returns an empty balanced cost leg.
- Every valuation line must have exactly one COGS account resolution and exactly one Inventory account resolution.
- COGS resolution must match:
  - Sales line ID;
  - Product ID;
  - Valuation Entry ID.
- Inventory resolution must match:
  - Sales line ID;
  - Product ID;
  - Movement ID;
  - Valuation Entry ID.
- Both resolved accounts must belong to the same Company as the valuation prerequisite.
- Missing, duplicate, extra or mismatched account resolutions fail closed.
- Positive outbound valuation cost is rejected because it violates the Phase 21 outbound sign convention.
- Multiple valuation currencies in one cost calculation fail closed instead of being summed without an explicit FX/accounting policy.
- Exact balance controls use safe-integer money and BigInt accumulation to prevent floating-point or overflow drift.
- Step 14 verifies:

```text
Total COGS Debit == Total Inventory Credit
Total Debit       == Sum(abs(resolved outbound valuation totalCost))
Total Credit      == Sum(abs(resolved outbound valuation totalCost))
```

- Each component preserves:
  - Sales line ID;
  - Product ID;
  - Movement ID;
  - Valuation Entry ID;
  - valuation method;
  - valuation revision;
  - currency.
- Step 14 produces posting components only. It does not create JournalLine or JournalVoucher entities; Step 24 owns Journal creation/provenance.

### Accounting model

For an authoritative Phase 21 outbound valuation:

```text
totalCost = -1,200,000 IRR
```

Step 14 produces:

```text
COGS               Dr  1,200,000
    Inventory          Cr  1,200,000
```

The absolute value is an accounting presentation transformation only; the original signed valuation fact remains unchanged and is retained by Valuation provenance.

### Authority boundary

```text
Phase 21 Valuation
  signed totalCost
        ↓
Step 12
  COGS account
        ↓
Step 13
  Inventory account
        ↓
Step 14
  balanced cost posting components
```

Step 14 never derives cost from:

- Sales selling price;
- Revenue amount;
- Product master price;
- Phase 24 pre-finalization cost quote.

### Argin Bridge compliance

- Durable Sales Line, Movement and Valuation Entry IDs remain on every component.
- Valuation revision and method are preserved for audit/replay.
- Account identity remains durable `accountId`.
- Signed upstream valuation is not rewritten.
- Calculation is deterministic and persistence-neutral.
- No SQLite row identity or UI state is used.
- Future remote replay can verify the exact valuation revision/account mapping consumed by the accounting effect.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-cost-posting-calculation.test.ts
```

Coverage includes:

- balanced FIFO COGS/Inventory effect;
- balanced Moving Average effect;
- zero-cost valuation;
- service/no-stock empty cost leg;
- missing account resolution;
- duplicate resolution;
- extra unknown-line resolution;
- COGS valuation provenance mismatch;
- Inventory Movement provenance mismatch;
- cross-company account rejection;
- positive outbound valuation rejection;
- mixed valuation-currency rejection;
- preservation of Sales/Movement/Valuation provenance;
- explicit proof that no JournalLine/JournalVoucher responsibility leaks into Step 14.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

The implementation was reviewed against the actual Phase 21 outbound sign convention and the completed Step 11/12/13 contracts. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain owner-side executable validation.

### Exit criteria

- [x] Authoritative Phase 21 total cost is the sole monetary source.
- [x] Signed outbound cost is transformed to positive accounting amount without rewriting valuation.
- [x] COGS is Debit and Inventory Asset is Credit.
- [x] FIFO/MWA accounting direction is identical.
- [x] Every stock valuation line has exact COGS and Inventory resolutions.
- [x] Account/provenance mismatch fails closed.
- [x] Zero-cost lines do not create synthetic entries.
- [x] Service/no-stock cost leg is empty and balanced.
- [x] Multiple currencies are not summed without policy.
- [x] Debit/Credit and valuation totals reconcile exactly.
- [x] Sales/Movement/Valuation provenance remains attached.
- [x] No Journal creation leaked into Step 14.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 15 — Mixed Stock + Service Invoice Orchestration.

## Step 15 — Mixed Stock + Service Invoice Orchestration

### Completed work

- Added `orchestrateMixedSalesInvoicePosting()` as a deterministic composition boundary for invoices containing both stock and non-stock/service lines.
- The orchestrator consumes already-calculated, already-balanced:
  - commercial posting from Step 7;
  - cost posting from Step 14.
- Step 15 does not re-price Sales, re-resolve Inventory lineage, re-run valuation or create Journal entities.
- The commercial leg remains authoritative for the whole invoice and may contain AR, Revenue and Output VAT components for stock and service/non-stock lines.
- The cost leg is restricted strictly to `stock-product` lines.
- Service/non-stock lines are prohibited from receiving COGS or Inventory Relief components.
- Mixed path requires at least one stock line and at least one non-stock/service line.
- Stock-only and service-only documents are deliberately outside Step 15; service-only becomes Step 16.
- Commercial component source-line references must point to actual Sales lines.
- Cost component Sales-line references must point only to actual stock lines.
- A non-zero stock cost line must preserve the expected two-component shape:
  - `cogs` debit;
  - `inventory-asset` credit.
- Commercial currency must equal the immutable Sales commercial-input currency.
- Cost currency, when present, must equal the commercial currency.
- Commercial and cost legs remain separately balanced rather than being mathematically netted into one opaque total.
- Step 15 returns both legs and their provenance explicitly so later Journal generation can preserve commercial-vs-cost meaning.
- No pending/retry/status state is added here; Step 17 owns resumable automatic orchestration.
- No Journal Voucher or Journal Line is created here; Step 24 owns Journal creation.

### Mixed invoice model

```text
Mixed Sales Invoice
  ├─ Stock product line
  │     ├─ Commercial leg
  │     │    Revenue / VAT / AR
  │     └─ Cost leg
  │          COGS / Inventory Relief
  │
  └─ Service / non-stock line
        └─ Commercial leg only
             Revenue / VAT / AR
```

Important:

```text
Commercial leg applies to all Sales lines.
Cost leg applies only to stock-product lines.
```

### Authority boundary

```text
Phase 24 Sales facts
        ↓
Step 7 commercial posting
        ┐
        ├─ Step 15 mixed orchestration
        ┘
Step 8-14 stock/valuation chain
        ↓
Step 14 cost posting
```

Step 15 composes these effects but does not replace either source of truth.

### Argin Bridge compliance

- Durable Sales document/line provenance remains explicit.
- Cost components retain Movement/Valuation provenance from the stock path.
- Commercial and cost effects remain independently reconstructable/replayable.
- No local database row IDs, UI state or transient orchestration identifiers become business identity.
- The composition result is deterministic and persistence-neutral.
- Future Bridge replay can distinguish commercial recognition from inventory-cost recognition.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-mixed-invoice-orchestration.test.ts
```

Coverage includes:

- successful mixed stock + service orchestration;
- commercial coverage for both stock and service lines;
- cost components only for stock lines;
- stock-only input rejection from the mixed path;
- service-only input rejection from the mixed path;
- service/non-stock cost leakage rejection;
- unknown commercial Sales-line reference rejection;
- commercial/cost currency mismatch rejection;
- independent commercial-leg and cost-leg balance preservation;
- explicit proof that Step 15 does not create Journal or retry/status state.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

The implementation composes the completed Step 7 and Step 14 contracts without moving retry/persistence/Journal ownership forward from their frozen steps. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain owner-side executable validation.

### Exit criteria

- [x] Mixed invoice requires stock plus service/non-stock content.
- [x] Commercial leg remains whole-invoice.
- [x] Cost leg is stock-only.
- [x] Service/non-stock lines cannot receive COGS/Inventory Relief.
- [x] Unknown Sales-line references fail closed.
- [x] Commercial and cost currency compatibility is enforced.
- [x] Commercial and cost balance remains independently visible.
- [x] No valuation or commercial recalculation is introduced.
- [x] No retry/status orchestration leaked from Step 17.
- [x] No Journal creation leaked from Step 24.
- [x] Result remains persistence-neutral and Bridge-ready.

## Next Step

Step 16 — Service-Only Invoice Posting Path.

## Step 16 — Service-Only Invoice Posting Path

### Completed work

- Added `orchestrateServiceOnlySalesInvoicePosting()` as the dedicated path for Sales Invoices containing only `service` lines.
- Service-only posting consumes the already-balanced commercial posting from Step 7.
- The path explicitly bypasses:
  - Inventory Issue creation/lookup;
  - Inventory Movement lineage;
  - FIFO/MWA valuation;
  - COGS account resolution;
  - Inventory account resolution;
  - COGS / Inventory Relief posting.
- The returned contract explicitly states:
  - `inventoryRequired = false`;
  - `costPostingRequired = false`.
- Service-only is defined strictly: every Sales line must have `lineKind = service`.
- `stock-product` and `non-stock-product` lines are rejected from this path rather than silently treated as services.
- The source must be a `sales-invoice`; Sales Return and correction flows remain in their frozen later steps.
- Commercial posting currency must match the immutable Sales commercial-input currency.
- Commercial Debit/Credit must remain balanced and must reconcile to the authoritative Sales document grand total.
- Commercial component line references must point only to actual service lines in the invoice.
- Every non-zero service line must retain its Revenue component coverage.
- AR remains document-level while Revenue/VAT remain line-provenance aware.
- No synthetic zero cost leg is created: Inventory/Valuation/COGS are absent, not merely empty work executed unnecessarily.
- No pending/retry/status state is added; Step 17 owns resumable automatic orchestration.
- No Journal Voucher/Journal Line is created; Step 24 owns Journal creation.

### Service-only model

```text
Service-Only Sales Invoice
        ↓
Immutable Sales commercial facts
        ↓
Commercial Posting
  Accounts Receivable    Dr
      Service Revenue       Cr
      Output VAT            Cr
        ↓
No Inventory Issue
No Inventory Movement
No FIFO/MWA Valuation
No COGS
No Inventory Relief
```

Important:

```text
Service Revenue recognition != Inventory fulfillment
```

A service invoice becomes accounting-ready from its commercial facts without waiting on stock prerequisites.

### Boundary with non-stock products

Step 16 is intentionally strict:

```text
service            -> Service-only path
non-stock-product  -> not classified as service-only
stock-product      -> not classified as service-only
```

This prevents a future non-stock-product accounting policy from being accidentally collapsed into service behavior.

### Argin Bridge compliance

- Durable Sales document and service-line identities remain the source provenance.
- No Inventory/Valuation identity is fabricated for services.
- No local row IDs or UI state become business identity.
- The result is deterministic and persistence-neutral.
- Future replay can reproduce the commercial effect without inventing stock effects.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-service-only-posting.test.ts
```

Coverage includes:

- successful multi-line service-only posting;
- explicit Inventory bypass;
- explicit Cost Posting bypass;
- stock-product rejection;
- non-stock-product rejection;
- non-invoice source rejection;
- commercial currency mismatch rejection;
- commercial total mismatch rejection;
- unknown Sales-line reference rejection;
- required Revenue coverage for non-zero service lines;
- explicit proof that Inventory, Movement, Valuation, COGS, Journal and retry/status artifacts do not leak into Step 16.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

The implementation was reviewed against the completed commercial posting contract and the Phase 25 ownership rule that service-only invoices bypass Inventory/Valuation/COGS entirely. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain owner-side executable validation.

### Exit criteria

- [x] Service-only path requires only `service` lines.
- [x] Sales Invoice source is enforced.
- [x] Commercial posting remains authoritative and balanced.
- [x] Commercial totals reconcile to Sales grand total.
- [x] Service line provenance is validated.
- [x] Inventory Issue is not required.
- [x] Inventory Movement is not required.
- [x] FIFO/MWA Valuation is not required.
- [x] COGS and Inventory Relief are not created.
- [x] Non-stock-product is not silently treated as service.
- [x] No retry/status ownership leaked from Step 17.
- [x] No Journal creation leaked from Step 24.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 17 — Automatic Post-Finalization Orchestration & Resumable Pending State.

## Step 17 — Automatic Post-Finalization Orchestration & Resumable Pending State

### Completed work

- Added an application-level `orchestrateSalesPostFinalization()` boundary for finalized Sales Invoices.
- Introduced explicit orchestration statuses:
  - `pending`;
  - `ready`.
- Introduced resumable pending reasons:
  - `waiting-for-issue`;
  - `waiting-for-confirmation`;
  - `waiting-for-movement`;
  - `waiting-for-valuation`.
- Added explicit invoice-path classification:
  - `service-only`;
  - `stock-only`;
  - `mixed`.
- Service-only invoices become immediately accounting-ready through the Step 16 commercial-only path and do not enter Inventory/Valuation waiting states.
- Stock and Mixed invoices progress deterministically through the dependency chain:

```text
Finalized Sales Invoice
        ↓
Issue exists?
        ↓
Issue confirmed?
        ↓
Movement lineage exists?
        ↓
Resolved valuation exists?
        ↓
Cost posting ready?
        ↓
Accounting-ready
```

- Missing future-resolvable dependencies return `pending` rather than terminal failure.
- The pending result preserves:
  - Sales document ID;
  - Company ID;
  - invoice path;
  - exact pending reason;
  - affected Sales line IDs.
- Re-running the same orchestration function with newly available dependencies resumes from the current authoritative facts rather than mutating a hidden workflow cursor.
- Company/source-document scope is revalidated when Fulfillment, Issue, Movement and Valuation artifacts are supplied.
- Stock/Mixed readiness still requires balanced cost posting from Step 14.
- Mixed-ready execution reuses the Step 15 invariant checks.
- Service-ready execution reuses the Step 16 invariant checks.
- `non-stock-product` is intentionally not silently collapsed into service-only or stock-only behavior; an explicit later policy is required.
- Mapping/configuration/structural inconsistencies are not disguised as transient pending states.
- No retry counter, idempotency key or exactly-once Journal effect is implemented here; Step 18 owns idempotency/replay.
- No CAS/version transition is implemented here; Step 19 owns optimistic concurrency.
- No Unit of Work/Outbox is implemented here; Step 20 owns atomic commit boundaries.
- No Journal Voucher creation occurs here; Step 24 owns Journal creation.

### Resumable state model

```text
pending / waiting-for-issue
        ↓
pending / waiting-for-confirmation
        ↓
pending / waiting-for-movement
        ↓
pending / waiting-for-valuation
        ↓
ready
```

The state is rebuildable from authoritative upstream facts. It is not a second source of truth for Sales, Inventory or Valuation.

### Argin Bridge compliance

- Pending state is a deterministic projection from durable Sales/Inventory/Valuation identities.
- No local row ID or in-memory lock is treated as synchronization authority.
- Exact affected Sales line IDs remain available for future retry/replay diagnostics.
- Source/Company scope is preserved throughout the chain.
- Future Bridge workers can re-run orchestration from authoritative synchronized facts without relying on an opaque local cursor.

### Automated tests

Added:

```text
packages/sales-posting/tests/post-finalization-orchestrator.test.ts
```

Coverage includes:

- service-only immediate readiness;
- stock waiting for Issue;
- waiting for Issue confirmation;
- confirmed Issue waiting for Movement;
- Movement waiting for Valuation;
- stock readiness after valuation/cost availability;
- mixed readiness through the same chain;
- rejection of silent `non-stock-product` classification.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

The design follows the existing Purchase Posting principle that finalized commercial facts remain valid when downstream accounting prerequisites are incomplete, while adapting Sales to its explicit Issue -> Movement -> Valuation chain. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain owner-side executable validation.

### Exit criteria

- [x] Finalized Sales posting has an application orchestration boundary.
- [x] Service-only invoices become ready without Inventory prerequisites.
- [x] Stock/Mixed invoices expose deterministic pending reasons.
- [x] Missing future dependencies are resumable rather than terminal.
- [x] Pending state identifies affected Sales lines.
- [x] Re-run with new facts resumes deterministically.
- [x] Scope mismatch fails explicitly.
- [x] Structural/configuration errors are not mislabeled as pending.
- [x] Step 18 idempotency ownership is preserved.
- [x] Step 19 CAS ownership is preserved.
- [x] Step 20 Unit of Work/Outbox ownership is preserved.
- [x] Step 24 Journal ownership is preserved.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 18 — Idempotency & Exactly-Once Journal Effect.

## Step 18 — Idempotency & Exactly-Once Journal Effect

### Completed work

- Added the Sales Posting idempotency contract for the accounting-recognition business effect.
- The canonical idempotency identity is now:

```text
Sales source identity
  sourceSystem
  sourceType
  sourceDocumentId
  sourceVersion
        +
purpose = accounting-recognition
        +
payloadFingerprint (SHA-256)
```

- Added deterministic `createSalesPostingIdempotencyKey()`.
- The durable key includes the exact Sales source version and posting purpose.
- Added SHA-256 payload fingerprint validation using 64 lowercase hexadecimal characters.
- Added `SalesPostingIdempotencyRecord` preserving the committed outcome:
  - idempotency key;
  - Sales source identity/version;
  - purpose;
  - payload fingerprint;
  - Posting ID;
  - Journal Voucher ID;
  - committed Posting version;
  - committed UTC timestamp.
- Added `assertSalesPostingReplayCompatible()`.
- An exact compatible retry reuses the stored outcome.
- A retry using the same business identity but a different payload fingerprint fails with `sales_posting.idempotency_conflict`.
- A new Sales source version receives a distinct business-effect identity.
- Added application-level `resolveSalesPostingJournalEffect()` against a persistence-neutral replay-store port.
- The first compatible execution records one outcome.
- Subsequent compatible retries return:
  - the original Posting ID;
  - the original Journal Voucher ID;
  - `replayed = true`.
- Compatible replay does not intentionally save a second business effect.
- Stored outcome validation fails closed if Posting/Journal identity, committed version or committed timestamp is malformed.
- Step 18 establishes the exactly-once business-effect identity and replay semantics without pulling forward CAS or transaction ownership.
- Step 19 remains responsible for optimistic concurrency/CAS.
- Step 20 remains responsible for the atomic Unit of Work / database uniqueness / outbox boundary that closes storage races.
- Step 24 remains responsible for creating the actual Accounting Journal Voucher against this durable idempotent identity.

### Exactly-once model

```text
sales:sales-invoice:<documentId>:v<sourceVersion>
        +
purpose:accounting-recognition
        ↓
Idempotency Key
        ↓
Existing record?
   no  -> commit one canonical outcome
   yes
        ↓
Fingerprint equal?
   yes -> replay original Posting/Journal outcome
   no  -> conflict
```

Example:

```text
Invoice INV-100 / sourceVersion 7
payloadFingerprint A
        ↓
Posting P-1 / Journal J-1

Retry:
INV-100 / version 7 / fingerprint A
        ↓
Replay P-1 / J-1

Conflicting retry:
INV-100 / version 7 / fingerprint B
        ↓
IDEMPOTENCY CONFLICT

New authoritative version:
INV-100 / version 8
        ↓
new business-effect identity
```

### Replay ordering rule

Idempotency/replay is resolved before a genuinely new business effect proceeds to later mutation/concurrency handling.

This preserves the same principle already established in Sales Workflow and Purchase Posting: an exact retry may replay its historical committed result even when later aggregate state has advanced, while an incompatible request cannot silently overwrite the previous outcome.

### Argin Bridge compliance

- Idempotency identity is based only on durable Sales source identity/version and purpose.
- Payload fingerprint protects replay compatibility across retries, restarts and future Bridge delivery.
- Stored outcome carries durable Posting/Journal identities rather than local row IDs.
- Replay can be reconstructed after process restart from persistent idempotency data.
- A synchronized retry with the same source/version/payload converges on the same accounting effect.
- Incompatible payload for the same effect becomes an explicit conflict rather than last-write-wins mutation.

### Automated tests

Added:

```text
packages/sales-posting/tests/replay-safe-journal-effect.test.ts
```

Coverage includes:

- deterministic source-version idempotency key;
- first execution stores exactly one canonical outcome;
- compatible retry replays the original Posting/Journal IDs;
- compatible retry does not save a second record;
- same identity with different fingerprint conflicts;
- new source version creates a distinct business-effect identity;
- malformed fingerprint rejection;
- malformed committed outcome rejection;
- restart-safe preservation of Posting ID, Journal ID and committed Posting version.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

Step 18 defines and tests the deterministic exactly-once business-effect/replay contract. It intentionally does not claim that an unimplemented persistence adapter can defeat a simultaneous insert race by itself; the database transaction, uniqueness and Unit-of-Work boundary is owned by Step 20. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain owner-side executable validation.

### Exit criteria

- [x] Accounting-recognition purpose is explicit.
- [x] Idempotency key is deterministic by durable Sales source version.
- [x] Payload compatibility is protected by SHA-256 fingerprint.
- [x] Compatible retry replays original outcome.
- [x] Compatible retry does not intentionally create a second business effect.
- [x] Incompatible same-identity payload fails as conflict.
- [x] New source version is a distinct business effect.
- [x] Posting and Journal outcome identities are retained for restart replay.
- [x] No local row identity participates in replay identity.
- [x] Step 19 CAS ownership remains intact.
- [x] Step 20 atomic/uniqueness ownership remains intact.
- [x] Step 24 Journal creation ownership remains intact.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 19 — Optimistic Concurrency & Posting CAS.

## Step 19 — Optimistic Concurrency & Posting CAS

### Completed work

- Added explicit optimistic concurrency controls for the Sales Posting aggregate.
- Added `SalesPostingConcurrencyExpectation` containing:
  - Posting ID;
  - Company ID;
  - Branch ID;
  - exact Sales source identity/version;
  - expected Posting version.
- Added `assertSalesPostingConcurrency()`.
- CAS now fails closed when:
  - Posting ID differs;
  - Company differs;
  - Branch differs;
  - Sales source identity/version differs;
  - current Posting version differs from `expectedPostingVersion`.
- Stale version conflicts use the explicit `sales_posting.concurrency_conflict` code.
- Identity/scope/source mismatches use `sales_posting.concurrency_state_mismatch`.
- Added `applySalesPostingCompareAndSwap()`.
- Successful CAS:
  - preserves immutable Posting/Company/Branch/source identity;
  - increments Posting version exactly once;
  - advances `updatedAtUtc`;
  - rejects timestamp regression.
- The prior aggregate remains immutable.
- Added `prepareSalesPostingMutation()` to enforce the required ordering between Step 18 replay safety and Step 19 CAS.
- Replay lookup now occurs before optimistic-concurrency validation.
- If a compatible idempotency record already exists, the historical committed outcome is replayed even when the current Posting aggregate has since advanced to a later version.
- If no replay exists, CAS is enforced before a new mutation proceeds.
- This preserves the distinction:
  - Idempotency protects retry/replay identity;
  - CAS protects genuinely new concurrent mutation.
- No database-specific `UPDATE ... WHERE version = ?` adapter is introduced here; Step 20 owns the atomic persistence/UoW boundary.
- No Journal lifecycle/version mutation is introduced here; Step 24 remains the Journal creation boundary.

### Concurrency model

```text
Retry / mutation request
        ↓
Step 18 replay lookup
        ↓
Existing compatible outcome?
   yes -> replay original result
   no
        ↓
Step 19 CAS
current.version == expectedVersion?
   no -> concurrency conflict
   yes
        ↓
version = version + 1
```

Example:

```text
Posting current version = 3

Exact historical retry:
stored idempotency outcome exists
expectedVersion = 1
        ↓
Replay succeeds
CAS is not evaluated

New mutation:
no replay record
expectedVersion = 1
        ↓
CAS conflict
```

### Source/scope protection

CAS is not only a numeric version check. The mutation expectation must target the exact same:

```text
postingId
companyId
branchId
Sales source document
Sales source version
```

This prevents accidentally applying a valid version number to the wrong Posting aggregate or source revision.

### Argin Bridge compliance

- Posting version remains a durable optimistic-concurrency token.
- Source identity/version remains part of the mutation expectation.
- Replayed historical outcomes are stable across restarts and future Bridge delivery.
- New stale mutations fail rather than silently overwriting synchronized state.
- CAS contract is persistence-neutral and can be implemented later with SQLite or server-side PostgreSQL compare-and-swap semantics.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-posting-concurrency.test.ts
```

Coverage includes:

- successful CAS;
- exactly-one version increment;
- immutable prior aggregate;
- stale-version conflict;
- Posting ID mismatch;
- Company mismatch;
- Branch mismatch;
- source-version mismatch;
- timestamp regression rejection;
- replay-before-CAS ordering;
- successful historical replay despite stale expected version;
- CAS enforcement after replay miss.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

The implementation follows the Phase 24 Sales concurrency rule: replay/idempotency is evaluated first, and CAS is enforced only for a genuinely new mutation. Successful local runtime/typecheck execution is not claimed from this environment; the commands above remain owner-side executable validation.

### Exit criteria

- [x] Posting aggregate has an explicit expected-version CAS contract.
- [x] Successful mutation increments version exactly once.
- [x] Stale expected version fails explicitly.
- [x] Posting/Company/Branch/source identity mismatch fails explicitly.
- [x] Timestamp regression is rejected.
- [x] Prior aggregate remains immutable.
- [x] Replay lookup occurs before CAS.
- [x] Exact historical retry can replay after aggregate version advances.
- [x] New mutation still enforces CAS after replay miss.
- [x] Step 20 persistence/UoW ownership remains intact.
- [x] Step 24 Journal lifecycle ownership remains intact.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 20 — Atomic Unit of Work / Outbox Boundary.

## Step 20 — Atomic Unit of Work / Outbox Boundary

### Completed work

- Added `SalesPostingAtomicUnitOfWork` and `SalesPostingAtomicSession` as persistence-neutral transaction contracts.
- Added `commitSalesPostingAccountingEffectAtomic()`.
- New accounting effect commit now coordinates, inside one Unit of Work:
  - replay/idempotency lookup;
  - current Posting load;
  - optimistic CAS transition;
  - durable Idempotency record;
  - durable Outbox event.
- CAS adapters must return `false` when the expected version no longer matches; this becomes `sales_posting.atomic_commit_conflict`.
- A compatible existing Idempotency record returns the stored outcome and does not intentionally perform a second CAS or append a second Outbox event.
- An incompatible replay still fails through the Step 18 fingerprint conflict contract.
- Added `SalesPostingOutboxEvent` with durable provenance:
  - event ID;
  - event type;
  - Posting aggregate ID;
  - Company ID;
  - Sales source document ID/version;
  - committed Posting version;
  - Journal Voucher ID;
  - occurred-at UTC.
- Event type is fixed to `sales-posting.accounting-recognition.committed`.
- The Outbox event is created in the same transaction boundary as Posting CAS and Idempotency evidence.
- If Outbox persistence fails, the Unit of Work must roll back the Posting mutation and Idempotency record.
- If CAS fails, no Idempotency or Outbox evidence may remain.
- Journal Voucher creation itself is still deferred to Step 24; Step 20 only reserves the atomic persistence boundary that will include the Journal write when Step 24 is implemented.

### Atomic model

```text
BEGIN UOW
  replay lookup
  if replay -> return prior outcome

  load Posting
  CAS UPDATE expectedVersion
  save Idempotency record
  append Outbox event
COMMIT
```

Failure at any write stage:

```text
ROLLBACK
```

### Outbox model

```text
sales-posting.accounting-recognition.committed
  eventId
  aggregateId
  companyId
  sourceDocumentId
  sourceVersion
  postingVersion
  journalVoucherId
  occurredAtUtc
```

The Outbox is local durable integration evidence. Live Bridge transport/acknowledgement remains outside Phase 25.

### Argin Bridge compliance

- Outbox payload uses only durable business identities.
- Posting version and Sales source version are preserved.
- Replay and Outbox creation converge on one committed accounting effect.
- Transport is decoupled from the local transaction.
- No in-memory event dispatch is treated as durable integration evidence.

### Automated tests

Added:

```text
packages/sales-posting/tests/atomic-posting-unit-of-work.test.ts
```

Coverage includes:

- atomic Posting CAS + Idempotency + Outbox success;
- CAS zero-row conflict;
- rollback when Outbox persistence fails;
- compatible replay with no duplicate CAS/Outbox;
- incompatible fingerprint conflict without extra side effects;
- durable source/Posting/Journal provenance in the Outbox event.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

This step defines the atomic persistence contract and verifies rollback semantics with a transactional in-memory test harness. A concrete SQLite adapter/migration is not introduced by this step because the frozen Phase 25 plan assigns the cross-module Journal write to Step 24; the same Unit-of-Work contract is prepared to include that write atomically. Successful local runtime/typecheck execution is not claimed from this environment.

### Exit criteria

- [x] Posting CAS, Idempotency evidence and Outbox event share one UoW boundary.
- [x] CAS failure leaves no partial evidence.
- [x] Outbox failure requires rollback.
- [x] Compatible replay creates no duplicate Outbox event.
- [x] Incompatible replay fails closed.
- [x] Outbox event preserves durable Sales/Posting/Journal provenance.
- [x] Live transport remains outside the local transaction.
- [x] Step 24 Journal creation ownership remains intact.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 21 — Sales Return Commercial Reversal.

## Step 21 — Sales Return Commercial Reversal

### Completed work

- Added explicit Sales Return commercial reversal support.
- Added `createSalesReturnCommercialLineage()` to validate immutable return-to-original-invoice lineage from the Phase 24 Sales Return document.
- Sales Return must reference an original `sales-invoice` through `relatedDocumentReference`.
- Every return line must point to an original invoice line through its Sales `sourceReference`.
- Return-line Product identity must remain compatible with the posting commercial facts.
- Added `reverseSalesReturnCommercialPosting()`.
- Commercial amount authority remains the immutable Sales Return commercial snapshot/totals; Step 21 does not recalculate the return amount from the original invoice.
- Original invoice identity is retained strictly as lineage/audit provenance.
- The normal commercial direction is reversed exactly:
  - Accounts Receivable: Debit -> Credit;
  - Sales Revenue: Credit -> Debit;
  - Output VAT: Credit -> Debit.
- Component amounts and account identities are preserved while debit/credit sides are inverted.
- Each line-level reversal component retains:
  - return Sales line ID;
  - original invoice ID;
  - original invoice line ID.
- Document-level AR reversal retains the original invoice ID while line ID remains null.
- Commercial reversal remains independently balanced.
- Step 21 does not create Inventory Receipt effects, valuation restoration, COGS reversal or Inventory restoration; those remain Step 22.
- Step 21 does not create Journal Voucher/Journal Lines; Step 24 remains Journal creation owner.

### Accounting model

Original sale:

```text
Accounts Receivable    Dr  110
    Sales Revenue          Cr  100
    Output VAT             Cr   10
```

Sales Return commercial reversal:

```text
Sales Revenue          Dr  100
Output VAT             Dr   10
    Accounts Receivable    Cr  110
```

The return amount is sourced from the authoritative Sales Return commercial facts, not from mutable current price/tax master data.

### Lineage model

```text
Sales Return
  relatedDocumentReference
        ↓
Original Sales Invoice

Return Line
  sourceReference.sourceLineId
        ↓
Original Invoice Line
```

This lineage is preserved alongside reversal components so later Journal provenance can show exactly which original invoice/line was reversed.

### Argin Bridge compliance

- Return document ID and source version remain durable business identities.
- Original invoice and original invoice-line IDs remain immutable lineage.
- No mutable Product/price/tax master is used to reconstruct historical return amounts.
- Return posting can be deterministically replayed from synchronized Sales Return commercial facts.
- No SQLite row IDs or UI-only references participate in lineage.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-return-commercial-reversal.test.ts
```

Coverage includes:

- valid return-to-original-invoice lineage;
- AR reversal to Credit;
- Revenue reversal to Debit;
- Output VAT reversal to Debit;
- amount preservation;
- original invoice provenance;
- original invoice-line provenance;
- invalid original-invoice reference rejection;
- invalid line source-reference rejection;
- Product/lineage mismatch rejection;
- explicit proof that Inventory/Valuation/Journal responsibilities do not leak into Step 21.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

Step 21 intentionally separates commercial reversal from stock-cost restoration. The Sales Return document is the amount authority; the original invoice is lineage authority. Successful local runtime/typecheck execution is not claimed from this environment.

### Exit criteria

- [x] Sales Return must reference an original Sales Invoice.
- [x] Each return line preserves original invoice-line lineage.
- [x] Return commercial amounts come from immutable return facts.
- [x] Accounts Receivable is reversed to Credit.
- [x] Revenue is reversed to Debit.
- [x] Output VAT is reversed to Debit.
- [x] Reversal remains balanced.
- [x] Original invoice/document provenance is preserved.
- [x] Inventory/valuation restoration remains Step 22.
- [x] Journal creation remains Step 24.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 22 — Sales Return Inventory Receipt / Valuation Cost Restoration.

## Step 22 — Sales Return Inventory Receipt / Valuation Cost Restoration

### Completed work

- Added the Inventory/Valuation half of Sales Return posting.
- Added `resolveSalesReturnReceiptValuation()`.
- The resolver follows the authoritative chain:
  - finalized Sales Return;
  - confirmed Inventory Receipt staged from that Sales Return;
  - exact Receipt line linked to the Sales Return line;
  - exact positive inbound Inventory Movement;
  - resolved Phase 21 inbound Valuation Entry.
- Receipt source identity must be:
  - `sourceSystem = sales`;
  - `documentType = sales-return`;
  - exact Sales Return document ID.
- Only `stock-product` return lines participate in Inventory restoration.
- Service/non-stock return lines do not fabricate Inventory movements or cost effects.
- Receipt line Product identity must match the returned Sales line.
- Inventory Movement must be:
  - positive inbound quantity;
  - same Receipt/document line;
  - same Product/StockKey;
  - not transfer;
  - not reversal;
  - same business date;
  - recorded at Receipt confirmation.
- Resolved valuation must be the exact valuation for that inbound movement.
- Valuation must be:
  - `kind = inbound`;
  - `costState = resolved`;
  - non-negative total cost;
  - complete unit cost / total cost / valued-at evidence.
- Unresolved return valuation blocks cost restoration explicitly; zero is never fabricated.
- Added `calculateSalesReturnCostRestoration()`.
- Cost restoration accounting is:

```text
Inventory Asset    Dr
    COGS               Cr
```

- Monetary authority is the resolved Phase 21 inbound valuation total.
- Sales selling price, discounts, VAT and Grand Total never become Inventory receipt cost.
- The original outbound valuation/history is not edited or rewritten.
- Return cost components preserve:
  - Sales Return line ID;
  - original Sales Invoice line ID;
  - Product ID;
  - Inventory Receipt/document line;
  - inbound Movement ID;
  - Valuation Entry ID;
  - valuation method/revision.
- COGS/Inventory account resolutions must match the exact return line, Product, Movement, Valuation and Warehouse lineage.
- Zero-cost resolved inbound valuation creates no synthetic accounting lines.
- Step 22 still does not create Journal Voucher/Journal Lines; Step 24 remains the Journal creation owner.

### Accounting model

If the resolved inbound valuation for returned stock is:

```text
totalCost = 600 IRR
```

Step 22 creates:

```text
Inventory Asset    Dr  600
    COGS               Cr  600
```

This is separate from the Step 21 commercial reversal:

```text
Sales Revenue      Dr
Output VAT         Dr
    Accounts Receivable Cr
```

### Cost authority

```text
Sales Return commercial amount
        ✗ not Inventory cost

Phase 24 pre-sale cost quote
        ✗ not return cost

Resolved Phase 21 inbound valuation
        ✓ return-cost authority
```

The historical original outbound valuation is not overwritten. The inbound Receipt creates a new immutable movement/valuation fact.

### Lineage model

```text
Original Sales Invoice Line
        ↓
Sales Return Line
        ↓
Inventory Receipt Line
        ↓
Inbound Inventory Movement
        ↓
Resolved Inbound Valuation
        ↓
Inventory Dr / COGS Cr
```

### Argin Bridge compliance

- Durable Sales Return, original invoice-line, Receipt line, Movement and Valuation IDs are preserved.
- Historical outbound movement/valuation remains immutable.
- The restoration effect is rebuildable from authoritative Sales + Inventory + Valuation facts.
- No current selling price or local UI state participates in cost authority.
- Unresolved monetary state remains explicit and replay-safe.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-return-cost-restoration.test.ts
```

Coverage includes:

- confirmed Sales Return Receipt lineage;
- positive inbound Movement validation;
- resolved inbound Valuation lookup;
- Inventory Debit / COGS Credit restoration;
- return cost differing from commercial selling amount;
- unresolved valuation blocking;
- wrong Receipt source rejection;
- outbound Movement rejection;
- service-only return bypass.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

Step 22 deliberately treats the Sales Return Receipt as a new authoritative inbound Inventory fact. It restores accounting cost from the resolved valuation of that inbound fact and never edits the original outbound valuation. Successful local runtime/typecheck execution is not claimed from this environment.

### Exit criteria

- [x] Sales Return stock restoration requires a confirmed Inventory Receipt.
- [x] Receipt must originate from the exact Sales Return.
- [x] Return line -> Receipt line lineage is exact.
- [x] Receipt line -> positive inbound Movement lineage is exact.
- [x] Inbound Movement -> resolved Valuation lineage is exact.
- [x] Unresolved valuation blocks cost restoration.
- [x] Selling price is never used as Inventory cost.
- [x] Inventory is Debited and COGS is Credited.
- [x] Original outbound valuation remains immutable.
- [x] Service-only return creates no Inventory cost effect.
- [x] Journal creation remains Step 24.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 23 — Sales Correction & Replacement/Reversal Lineage.

## Step 23 — Sales Correction & Replacement/Reversal Lineage

### Completed work

- Added explicit Sales Correction lineage for accounting replacement/reversal.
- Added `createSalesCorrectionLineage()`.
- A Sales Correction must:
  - be a `sales-correction` document;
  - reference one originating `sales-invoice`;
  - give every correction line a durable Sales source reference to a concrete line of that same invoice.
- Correction document/line identities remain distinct from the original invoice/document identities.
- One correction line cannot silently claim the same original invoice line twice inside the same correction document.
- Lineage retains:
  - Correction document ID;
  - original Sales Invoice ID;
  - Correction line ID;
  - original invoice-line ID;
  - Product ID;
  - line kind.
- Added `createSalesCorrectionReplacementPlan()`.
- The accounting semantics are explicitly `reverse-and-replace`, not in-place mutation.
- The plan binds two independent durable Sales Posting source identities:
  - `originalSource` must be the exact referenced `sales-invoice` source/version;
  - `replacementSource` must be the exact `sales-correction` source/version.
- Original and replacement documents cannot collapse to the same business identity.
- The original invoice remains immutable historical fact.
- The original Posting/Journal remains immutable historical accounting fact.
- Later accounting processing must create compensating reversal/replacement effects through explicit lineage rather than editing old Journal lines.
- Step 23 deliberately does not create the reversal Journal or replacement Journal; Step 24 owns Journal Voucher creation/provenance.
- Inventory quantity/valuation correction is not inferred from commercial differences here; any required downstream Inventory compensation must follow Inventory-owned immutable movement workflows rather than rewriting prior movements.

### Correction model

```text
Original Sales Invoice v5
        ↓ immutable historical fact
Original Sales Posting / Journal
        ↓
explicit reversal lineage
        ↓
Sales Correction v2
        ↓ independent replacement fact
Replacement Sales Posting / Journal
```

Accounting history is therefore append-only:

```text
Original Effect
+ Compensating Reversal
+ Replacement Effect
= Corrected Net Position
```

No original commercial snapshot, Inventory movement, Valuation entry or posted Journal line is edited in place.

### Line-level lineage

```text
Sales Correction Line
        ↓ sourceReference
Original Sales Invoice Line
```

The lineage keeps Product/line classification alongside durable line IDs so a later accounting or Inventory correction cannot accidentally compensate a different line.

### Source-version identity

A Correction replacement plan preserves both revisions independently:

```text
originalSource
  sales-invoice / invoice-001 / sourceVersion 5

replacementSource
  sales-correction / correction-001 / sourceVersion 2
```

This allows Step 18 idempotency and Step 19 CAS to distinguish historical original recognition from the new replacement effect.

### Argin Bridge compliance

- Original and replacement Sales source identities/versions remain durable and independent.
- Correction lineage is append-only and survives synchronization without relying on SQLite row IDs.
- Replay can reconstruct which historical invoice effect is being compensated and which correction effect replaces it.
- Last-write-wins mutation of historical Sales/Journal facts is explicitly prohibited.
- Future Bridge synchronization can carry original/replacement lineage as durable business references.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-correction-lineage.test.ts
```

Coverage includes:

- valid Correction -> original Invoice lineage;
- valid Correction Line -> original Invoice Line lineage;
- preservation of Product/line-kind trace;
- explicit `reverse-and-replace` plan;
- preservation of independent original/replacement source versions;
- missing original invoice rejection;
- cross-invoice correction-line rejection;
- duplicate original-line replacement rejection;
- wrong original Posting source rejection;
- wrong replacement source type/document rejection.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

Step 23 freezes the immutable correction/replacement lineage and does not prematurely create Journal Vouchers. The actual controlled reversal/replacement Journal provenance is wired in Step 24. Successful local runtime/typecheck execution is not claimed from this environment.

### Exit criteria

- [x] Correction is a new durable Sales fact.
- [x] Original invoice remains immutable.
- [x] Every Correction line has exact original Invoice-line lineage.
- [x] Duplicate original-line replacement inside one Correction is rejected.
- [x] Original and replacement source versions are independent durable identities.
- [x] Accounting strategy is explicit reverse-and-replace.
- [x] Historical Posting/Journal facts are never edited in place.
- [x] Inventory/Valuation history is never rewritten by commercial correction logic.
- [x] Step 18 idempotency identities remain usable for original/replacement effects.
- [x] Step 19 CAS can target each Posting aggregate independently.
- [x] Journal creation/provenance remains Step 24.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 24 — Journal Voucher Creation & Immutable Source Provenance.

## Step 24 — Journal Voucher Creation & Immutable Source Provenance

### Completed work

- Added actual Accounting Journal Draft creation for Sales Posting by consuming the existing `@argin/accounting/journal` public contract rather than inventing a Sales-owned Journal model.
- Added `createSalesPostingJournalDraft()`.
- Added adapters that convert completed Phase 25 posting outputs into Journal-ready components:
  - ordinary Sales Invoice commercial posting;
  - ordinary stock COGS / Inventory Relief posting;
  - Sales Return commercial reversal;
  - Sales Return Inventory / COGS restoration.
- Correction replacement postings can use the same normalized component contract while Step 23 preserves original/replacement source identity.
- Journal Voucher is created as:
  - `status = draft`;
  - `source.type = source_document`;
  - source document ID = durable Sales source document ID;
  - correlation ID = durable Sales Posting ID;
  - request ID retained for replay trace;
  - voucher Version starts at 1.
- Journal date, Fiscal Year and Fiscal Period remain explicit inputs; Sales Posting does not bypass Accounting/Fiscal ownership.
- Journal total Debit/Credit must reconcile before Accounting creation is invoked.
- Mixed commercial + cost lines remain one balanced Journal draft while preserving their independent component provenance.
- Added readable Persian Journal line descriptions:
  - حساب دریافتنی فروش;
  - درآمد فروش;
  - مالیات بر ارزش افزوده فروش;
  - بهای تمام‌شده کالای فروش‌رفته;
  - موجودی کالا.
- Raw hash/component identifiers are no longer used as user-facing Journal descriptions.
- Added dedicated immutable `SalesPostingJournalProvenance` because Accounting Journal Line does not own Sales/Inventory/Valuation source metadata.
- Every Journal Line must have exactly one provenance record.
- Provenance preserves, when applicable:
  - Sales Posting ID;
  - Sales source document/type/version;
  - component ID and accounting role;
  - Sales line ID;
  - Customer Party ID;
  - Product ID;
  - Inventory Receipt/Issue document and line IDs;
  - Movement ID;
  - Valuation Entry ID;
  - FIFO/MWA method;
  - Valuation revision;
  - original Sales Invoice/document-line lineage for returns/corrections;
  - Tax IDs/Codes.
- Valuation provenance is fail-closed: a Valuation Entry cannot be recorded without Movement, Product, method and revision provenance.
- Added `commitSalesPostingJournalAtomic()`.
- Step 20 Atomic UoW is now operationally extended so a genuinely new accounting recognition effect commits:
  - Sales Posting CAS;
  - Accounting-owned Journal Draft;
  - immutable Sales Journal provenance;
  - Idempotency evidence;
  - Outbox event;
  inside one transaction boundary.
- Compatible replay loads and returns the already committed Posting/Journal/provenance and performs no duplicate writes.
- Atomic replay validates stored Journal + provenance consistency before returning the historical outcome.
- The Outbox event references the actual Accounting Journal Voucher created in the same transaction.
- Added `@argin/accounting` as an explicit Sales Posting workspace dependency and updated the pnpm lockfile.
- Journal posting/lifecycle approval remains Accounting-owned; Step 24 creates the source-owned draft and immutable provenance but does not bypass Accounting lifecycle controls.

### Journal model

Ordinary Sales Invoice:

```text
Accounts Receivable    Dr
COGS                   Dr
    Sales Revenue          Cr
    Output VAT             Cr
    Inventory              Cr
```

Service-only Sales Invoice:

```text
Accounts Receivable    Dr
    Service Revenue        Cr
    Output VAT             Cr
```

Sales Return:

```text
Sales Revenue          Dr
Output VAT             Dr
Inventory              Dr
    Accounts Receivable    Cr
    COGS                   Cr
```

The exact lines depend on authoritative commercial and valuation components; no amount is recalculated inside Journal creation.

### Ownership model

```text
Sales / Inventory / Valuation
        ↓ authoritative facts
Sales Posting
        ↓ balanced components + provenance
Accounting
        ↓ create Journal Voucher Draft
Journal Lifecycle
        ↓ Accounting-owned approval/posting/reversal
```

Sales Posting references Accounting-owned Journal identity; it does not copy or mutate Accounting Journal lifecycle state.

### Immutable provenance model

```text
Journal Voucher
  Journal Line A
      ↓
  SalesPostingJournalProvenance
      Sales Line / Customer / Tax

  Journal Line B
      ↓
  SalesPostingJournalProvenance
      Sales Line / Product
      Inventory Movement
      Valuation Entry / Method / Revision
```

This avoids overloading generic Accounting Journal Line with module-specific Sales/Inventory/Valuation fields while preserving full audit trace.

### Atomic model

```text
BEGIN UOW

Replay lookup
    ↓
if replay:
    load Posting
    load Journal
    load Provenance
    return historical outcome

otherwise:
    Sales Posting CAS
    create Accounting Journal Draft
    save immutable Journal provenance
    save Idempotency outcome
    append Outbox event

COMMIT
```

Any persistence failure is required to roll back the whole Unit of Work.

### Correction / replacement compatibility

Step 23 established:

```text
Original Invoice Posting
+ compensating reversal
+ Correction replacement posting
```

Step 24 now provides the Journal/provenance primitive required for each append-only accounting effect. It does not edit the original Journal.

### Argin Bridge compliance

- Journal trace uses durable Sales Posting, Sales source, Movement and Valuation identities.
- No SQLite row IDs participate in source provenance.
- Exact sourceVersion and Valuation revision remain traceable.
- Idempotent replay returns the same durable Journal identity.
- Outbox references the same Journal committed inside the UoW.
- Generic Accounting Journal remains authoritative for ledger state while Sales provenance remains source-module trace evidence.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-journal-draft.test.ts
```

Coverage includes:

- balanced Accounting Journal draft creation;
- source-owned Journal metadata;
- Persian readable line descriptions;
- exact one-to-one Journal-line provenance;
- Sales source version preservation;
- Sales line / Tax provenance;
- unbalanced component rejection;
- incomplete Valuation provenance rejection;
- atomic Journal + Posting CAS + provenance + Idempotency + Outbox commit contract;
- exact replay with no duplicate Journal/provenance/Outbox writes.

Local verification:

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm typecheck
pnpm test
```

### Validation note

Journal creation is now implemented against the real Accounting domain contract and wired to the Sales Posting atomic boundary. Executable local/CI success is not claimed from this connected environment; the commands above remain owner-side validation.

### Exit criteria

- [x] Sales Posting creates a real Accounting Journal Voucher Draft.
- [x] Accounting remains Journal owner.
- [x] Journal source is the durable Sales source document.
- [x] Journal is balanced before persistence.
- [x] Commercial and cost components retain separate provenance.
- [x] Every Journal line has immutable source provenance.
- [x] Sales/Inventory/Valuation IDs are retained without modifying Accounting Journal Line schema.
- [x] Valuation Method/Revision provenance is retained.
- [x] Sales Return original-invoice lineage is retained.
- [x] Correction reverse-and-replace lineage is compatible with append-only Journals.
- [x] Journal + provenance + Posting CAS + Idempotency + Outbox share an atomic boundary.
- [x] Compatible replay creates no duplicate Journal effect.
- [x] Persian Journal descriptions are human-readable.
- [x] Contract remains persistence-neutral and Bridge-ready.

## Next Step

Step 25 — Posting Status, Recovery & Deterministic Retry.

## Step 25 — Posting Status, Recovery & Deterministic Retry

### Completed work

- Reconciled the previously accepted Step 25 into the repository after detecting that the canonical plan had advanced only through Step 24.
- Added deterministic recovery projection with statuses:
  - `pending`;
  - `ready`;
  - `committed`;
  - `blocked`.
- Added retry decisions:
  - `wait` for unresolved future dependencies;
  - `retry` for retriable CAS/atomic conflicts;
  - `replay` for an already committed idempotent outcome;
  - `manual-review` for structural/accounting configuration failures;
  - `none` as an explicit terminal/no-action vocabulary member.
- Added `projectSalesPostingRecovery()`.
- Existing orchestration pending reasons from Step 17 remain authoritative for dependency waiting.
- Existing Step 18 Idempotency outcome is authoritative for `committed/replay`.
- Concurrency/atomic conflicts can be deterministically retried from current authoritative facts.
- Structural mapping/accounting failures are never hidden behind automatic retry.
- Added `assertDeterministicRecoveryTransition()`.
- A committed outcome cannot regress to Ready/Pending/Blocked.
- A committed outcome cannot later point at a different Journal Voucher.
- Recovery remains a projection/decision layer; it does not invent a second source of truth or mutate Sales/Inventory/Valuation facts.

### Recovery model

```text
Pending dependency
    -> wait

Ready + no committed effect
    -> retry

CAS / atomic conflict
    -> reload authoritative state
    -> retry

Committed idempotent effect
    -> replay same Journal outcome

Structural/mapping conflict
    -> blocked
    -> manual review
```

### Validation

Recovery coverage is included in:

```text
packages/sales-posting/tests/sales-posting-security.test.ts
```

and covers waiting, retry, replay, blocked/manual-review and committed non-regression.

## Step 26 — Permissions, Approval/Audit & Operational Trace

### Completed work

- Added dedicated Sales Posting permissions:
  - `sales.posting.view`;
  - `sales.posting.execute`;
  - `sales.posting.recover`;
  - `sales.posting.trace.view`.
- Added persistence-neutral authorization policy and security context contracts.
- Added `SecuredSalesPostingService` as the Application boundary for consequential Sales Posting operations.
- Execute authorization is enforced before Journal mutation/UoW execution.
- Recovery requires its own independent permission.
- Operational trace viewing requires its own independent permission.
- Company/Branch/Posting scope is revalidated against the persisted Posting aggregate before authorization/action.
- Added explicit approval evidence contract:
  - approval ID;
  - approver actor ID;
  - approval UTC timestamp.
- When an upstream Sales policy/workflow marks posting execution as approval-required, missing/invalid approval evidence fails with `sales_posting.approval_required`.
- Sales Posting does not create a parallel generic approval engine; it consumes approval evidence while Accounting retains Journal lifecycle/approval ownership.
- Added audit actions:
  - `sales-posting.execute`;
  - `sales-posting.replay`;
  - `sales-posting.recover`;
  - `sales-posting.trace.view`.
- Audit events retain:
  - actor;
  - Company/Branch;
  - Posting and Journal IDs;
  - request/operation/correlation/causation IDs;
  - source document/version;
  - before/after Posting version;
  - approval evidence when applicable;
  - recovery state when applicable;
  - replay/fingerprint/source-version metadata.
- Added deterministic `salesPostingAuditIdentity()` for append-only audit persistence.
- Added `SalesPostingTraceSnapshot` and `SalesPostingTraceReader`.
- Trace surfaces preserve the operational chain from Sales source through Posting/recovery to Journal identity without exposing mutable UI state as authority.
- Trace access is itself audited.
- Authorization denial occurs before mutation and does not emit a false success audit event.

### Security / trace model

```text
Actor
  ↓ permission + company/branch scope
Sales Posting operation
  ↓ requestId / operationId / correlationId / causationId
Approval evidence (when required)
  ↓
Atomic Posting / Journal effect
  ↓
Audit event
  ↓
Operational Trace
```

### Approval ownership

```text
Sales workflow/policy
    -> determines whether approval evidence is required

Sales Posting
    -> validates/retains approval evidence

Accounting Journal lifecycle
    -> remains Accounting-owned
```

Step 26 therefore does not duplicate the Accounting approval engine.

### Argin Bridge compliance

- Audit/trace uses durable actor, source, Posting and Journal identities.
- Request/operation/correlation/causation IDs are stable synchronization/diagnostic references.
- Authorization scope is based on Company/Branch business identity, not local database row IDs.
- Recovery and replay are observable without changing immutable source facts.

### Automated tests

Added:

```text
packages/sales-posting/tests/sales-posting-security.test.ts
```

Coverage includes:

- deterministic recovery states/actions;
- committed recovery non-regression;
- dedicated recovery permission enforcement;
- authorization denial before action;
- recovery audit trace;
- dedicated trace-view permission;
- trace-view auditing;
- deterministic audit identity;
- mandatory approval evidence before an approval-required execute operation.

### Local verification

```bash
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm typecheck
pnpm test
```

### Validation note

The connected GitHub environment was used to implement and review the contracts, but local runtime/typecheck PASS is not claimed.

### Exit criteria

- [x] Step 25 recovery status is explicit and deterministic.
- [x] Pending dependency uses wait rather than blind retry.
- [x] CAS/atomic conflict is explicitly retryable.
- [x] Committed result converges on replay.
- [x] Structural failures require manual review.
- [x] Committed result cannot regress or switch Journal identity.
- [x] Execute permission exists independently.
- [x] Recover permission exists independently.
- [x] Trace-view permission exists independently.
- [x] Company/Branch scope is validated before action.
- [x] Approval-required execution validates durable approval evidence.
- [x] Journal approval ownership remains Accounting-owned.
- [x] Execute/replay/recover/trace-view are auditable.
- [x] Request/operation/correlation/causation trace is preserved.
- [x] Trace access is itself audited.
- [x] Contracts remain persistence-neutral and Bridge-ready.

## Next Step

Step 27 — Persian RTL Posting Status/Recovery UI.

## Step 27 — Persian RTL Posting Status/Recovery UI

### Completed work

- Added a dedicated Persian RTL Sales Posting recovery/status presentation layer for Desktop.
- Added `createSalesPostingRecoveryViewModel()` as a pure UI projection over the authoritative Step 25 `SalesPostingRecoverySnapshot`.
- UI does not recompute posting readiness, retryability or accounting rules.
- Added Persian presentation for the four canonical recovery states:
  - `pending` -> «در انتظار تکمیل پیش‌نیازها»;
  - `ready` -> «آماده ثبت حسابداری»;
  - `committed` -> «ثبت حسابداری ایجاد شده»;
  - `blocked` -> «نیازمند بررسی».
- Added Persian action labels:
  - retry -> «تلاش مجدد»;
  - replay -> «بازخوانی نتیجه ثبت‌شده»;
  - manual-review -> «بررسی دستی»;
  - wait/none -> no misleading action button.
- Added human-readable Pending reason labels for:
  - waiting for Inventory Issue;
  - waiting for Issue confirmation;
  - waiting for Inventory Movement;
  - waiting for Valuation/COGS.
- Added human-readable structural/retry messages for common Sales Posting errors such as account mapping, non-postable account, ambiguous rules and optimistic-concurrency/atomic conflicts.
- Added `SalesPostingRecoveryPanel`:
  - explicit RTL direction;
  - current status;
  - recommended action;
  - Journal Voucher identity;
  - committed Posting version;
  - waiting Sales line IDs;
  - reason/explanation;
  - permission-aware recovery action;
  - optional refresh action;
  - operational trace details when `sales.posting.trace.view` is available.
- Operational trace UI exposes durable:
  - Posting ID/version;
  - Sales source document/version;
  - Journal Voucher ID;
  - Request ID;
  - Operation ID;
  - Correlation ID;
  - Causation ID.
- Trace identifiers use bidi-safe presentation rather than being mixed into Persian text.
- Added responsive Desktop styles matching the existing Sales workspace density/panel conventions.
- Pending/Ready/Committed/Blocked states have distinct semantic visual treatments without moving domain truth into CSS/React.
- The UI does not fabricate a Posting status from Sales document status, Inventory trace or local component state. It requires the authoritative Application recovery snapshot.
- Added `@argin/sales-posting` to Desktop workspace dependencies and updated the lockfile.

### UI model

```text
SalesPostingRecoverySnapshot
        ↓
pure Persian view model
        ↓
SalesPostingRecoveryPanel
        ↓
Status + reason + next action + trace
```

Examples:

```text
pending / waiting-for-valuation
→ در انتظار تکمیل پیش‌نیازها
→ علت: در انتظار محاسبه بهای تمام‌شده
→ no blind retry button
```

```text
ready / retry
→ آماده ثبت حسابداری
→ تلاش مجدد
```

```text
committed / replay
→ ثبت حسابداری ایجاد شده
→ Journal ID + Posting version
→ بازخوانی نتیجه ثبت‌شده
```

```text
blocked / manual-review
→ نیازمند بررسی
→ علت تنظیماتی/ساختاری
→ بررسی دستی
```

### Files

Added:

```text
apps/desktop/src/features/sales/sales-posting-recovery-view.ts
apps/desktop/src/pages/sales/sales-posting-recovery-panel.tsx
apps/desktop/src/pages/sales/sales-posting-recovery-panel.css
apps/desktop/tests/sales-posting-recovery-view.test.ts
```

Updated:

```text
apps/desktop/package.json
pnpm-lock.yaml
```

### Automated tests

Focused Desktop tests cover:

- Pending valuation -> Persian wait guidance;
- Ready concurrency conflict -> retry action;
- Committed -> replay + exact Journal identity/version;
- Structural account mapping failure -> manual review rather than blind retry.

Local verification:

```bash
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop test
pnpm --filter @argin/sales-posting typecheck
pnpm --filter @argin/sales-posting test
```

Recommended regression:

```bash
pnpm --filter @argin/sales typecheck
pnpm --filter @argin/sales test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm typecheck
pnpm test
```

### Validation note

The UI contract is implemented and tested as a data-driven projection over the Step 25 Application snapshot. It intentionally does not derive/fabricate authoritative posting state from the Sales document UI. End-to-end source -> Posting -> UI scenario wiring and automated integration coverage remains Step 28. Successful local runtime/typecheck execution is not claimed from the connected GitHub environment.

### Exit criteria

- [x] Persian RTL Posting status UI exists.
- [x] Pending/Ready/Committed/Blocked are clearly distinguishable.
- [x] Pending dependency reasons are human-readable.
- [x] Retry/replay/manual-review actions match Step 25 decisions.
- [x] Wait state does not expose a blind retry action.
- [x] Journal identity/version are shown for committed outcomes.
- [x] Waiting Sales line IDs are visible.
- [x] Operational trace is permission-aware.
- [x] Request/operation/correlation/causation IDs are displayable.
- [x] UI does not duplicate domain recovery logic.
- [x] UI does not fabricate posting state from document status.
- [x] Desktop dependency/lockfile are updated.
- [x] Responsive RTL styling follows current Sales workspace conventions.

## Next Step

Step 28 — Automated Integration & E2E Stock/Service/Return Scenarios.
