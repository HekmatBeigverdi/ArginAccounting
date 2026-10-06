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
| 4 | Revenue Account Resolution | Planned |
| 5 | Accounts Receivable Account Resolution | Planned |
| 6 | Output VAT Account Resolution | Planned |
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
