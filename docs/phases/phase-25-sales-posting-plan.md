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
| 7 | Commercial Posting Calculation & Balancing | Planned |
| 8 | Stock-Fulfillment Prerequisite Contract | Planned |
| 9 | Inventory Issue Lineage Resolution | Planned |
| 10 | Outbound Inventory Movement Lineage Resolution | Planned |
| 11 | Resolved FIFO/MWA Valuation Prerequisite | Planned |
| 12 | COGS Account Resolution | Planned |
| 13 | Inventory Account Resolution | Planned |
| 14 | COGS / Inventory Relief Posting Calculation | Planned |
| 15 | Mixed Stock + Service Invoice Orchestration | Planned |
| 16 | Service-Only Invoice Posting Path | Planned |
| 17 | Automatic Post-Finalization Orchestration & Resumable Pending State | Planned |
| 18 | Idempotency & Exactly-Once Journal Effect | Planned |
| 19 | Optimistic Concurrency & Posting CAS | Planned |
| 20 | Atomic Unit of Work / Outbox Boundary | Planned |
| 21 | Sales Return Commercial Reversal | Planned |
| 22 | Sales Return Inventory Receipt / Valuation Cost Restoration | Planned |
| 23 | Sales Correction & Replacement/Reversal Lineage | Planned |
| 24 | Journal Voucher Creation & Immutable Source Provenance | Planned |
| 25 | Posting Status, Recovery & Deterministic Retry | Planned |
| 26 | Permissions, Approval/Audit & Operational Trace | Planned |
| 27 | Persian RTL Posting Status/Recovery UI | Planned |
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
