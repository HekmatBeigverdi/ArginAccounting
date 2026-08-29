# Phase 17 — Parties — Fixed Implementation Plan

## Status

Phase 17 is active. Step 1 is completed. Steps 2–20 are not started.

## Governance Rule

This plan is frozen for the duration of Phase 17.

Before starting every step:

1. Read this document.
2. Read `docs/development/documentation-governance.md`.
3. Read `docs/development/github-publishing-workflow.md`.
4. Confirm the current branch and latest commit.
5. Confirm the previous step's exit criteria.
6. State the current step number, scope, expected files, and validation commands before implementation.
7. Update only status and evidence sections unless an explicit Change Request is approved.

A step may not be reordered, split, merged, removed, renamed, or materially expanded without explicit user approval. Newly discovered work must be recorded under **Change Requests** and must not silently alter the sequence.

## Phase Objective

Deliver the canonical Master Data model and desktop workflow for Parties in ArginAccounting. A Party represents a natural or legal person and may carry one or more commercial roles such as Customer or Supplier without duplicate master records. Phase 17 must provide a persistence-neutral Domain/Application model, Iranian identity and tax attributes, contacts and addresses, duplicate detection, SQLite persistence, authorization and audit integration, bulk import/export, reusable desktop selectors, and forward-compatible synchronization contracts for Argin Bridge and future hybrid deployment.

## Baseline

- Phase 16 — Accounting Reports is completed and prepared for semantic release `v0.16.0`.
- `main` baseline at Phase 17 kickoff: `044fcdc0dd42ffdb435c0b36277b148cf70afb31`.
- Phase 09 provides shared query, Unit of Work, optimistic concurrency, background jobs, notifications, metadata, and shared platform infrastructure.
- Phase 14 provides the canonical Persian RTL desktop design system, dense accounting UI patterns, keyboard/accessibility behavior, and display-density contract.
- Existing Company/Branch, Fiscal, Security, Audit, Approval, Chart of Accounts, Accounting Dimensions, Journal, Lifecycle, and Reports capabilities remain authoritative and must not be duplicated in Phase 17.

## Scope Boundaries

Included: Party aggregate and types, natural/legal person identity, Iranian registration/tax identifiers, Party roles, lifecycle, contacts, addresses, duplicate detection, Application contracts/services, SQLite schema/repository, atomic writes, optimistic concurrency, permissions/audit integration, future Approval hooks where justified, bulk Excel/CSV import/export, Persian RTL desktop Party management, reusable Party selector contracts, integration boundaries for later Sales/Purchases/Treasury modules, tests, performance validation, documentation, merge, and release.

Excluded: customer/supplier accounting balances, opening balances, sales/purchase documents, cheque/receivable behavior, bank operations, inventory ownership, posting rules, automatic journal posting, full PostgreSQL/Web implementation, active network synchronization, conflict-resolution UI, and the Phase 45 Synchronization engine.

## Argin Bridge and Future Synchronization Contract

Phase 17 does not implement the Argin Bridge transport or synchronization engine. It establishes the minimum durable entity contract required so that future offline/hybrid synchronization can be added without redesigning Party identity or persistence semantics.

The Party design must therefore preserve:

- Stable cross-database identity independent of SQLite row ids.
- Explicit local/display numbering separate from durable entity identity.
- Optimistic concurrency/version semantics.
- Durable created/updated metadata suitable for change tracking.
- Soft-delete/tombstone-compatible lifecycle semantics where deletion must propagate later.
- Source/external reference support where imported or bridged identities require traceability.
- Idempotent create/update integration boundaries.
- Persistence-neutral Application contracts that can later be implemented by SQLite, PostgreSQL, HTTP, or bridge adapters.
- No network or sync business rules embedded in React components or the Party aggregate.

Target future direction remains:

`Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`

Full synchronization remains Phase 45.

## Design Principles

- Party is the master entity; Customer and Supplier are roles, not duplicated master records.
- One Party may hold multiple roles simultaneously.
- Domain/Application owns validation and business invariants; React does not.
- SQLite is an adapter, not the source of business rules.
- Company scope and authorization are enforced at the Application boundary.
- Multi-write operations are atomic.
- Durable dates/timestamps remain Gregorian internally; Persian UI presents Solar Hijri where relevant.
- User-facing surfaces follow the Phase 14 Persian RTL design system and global density contract.
- Stable IDs, versions, and tombstone-compatible lifecycle rules must not depend on a future sync implementation.
- Import must preview, validate, report duplicates/errors, and avoid partial writes when atomic mode is selected.
- Search and selectors must remain practical for large Master Data sets and avoid loading all Parties into memory.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, and Plan Freeze | Completed |
| 2 | Party Domain Model and Classification | Not started |
| 3 | Party Roles and Lifecycle | Not started |
| 4 | Identity, Registration, and Tax Information | Not started |
| 5 | Contacts and Addresses | Not started |
| 6 | Application and Repository Contracts | Not started |
| 7 | Application Services and Duplicate Detection | Not started |
| 8 | Migration, Schema, and Indexing | Not started |
| 9 | SQLite Repository and Atomic Transactions | Not started |
| 10 | Argin Bridge and Future Synchronization Contract | Not started |
| 11 | Permissions, Audit, and Approval Integration | Not started |
| 12 | Bulk Import and Export | Not started |
| 13 | Persian RTL Party Management UI | Not started |
| 14 | Party Selector and Future Module Consumption Contract | Not started |
| 15 | Shared Platform and Accounting Integration | Not started |
| 16 | Domain and Application Tests | Not started |
| 17 | Repository, Migration, Import, and Desktop Tests | Not started |
| 18 | Monorepo, Performance, Accessibility, and Quality Validation | Not started |
| 19 | Documentation, ADR, and Validation Evidence | Not started |
| 20 | Final Review, Merge, and Release | Not started |

## Fixed Execution Sequence

### Step 1 — Baseline, Branch, and Plan Freeze
- Confirm the completed Phase 16 baseline and current `main` head.
- Create `phase/17-parties` from the current `main` head.
- Freeze Phase 17 objective, dependencies, scope, exclusions, Argin Bridge constraints, governance rules, and the complete 20-step sequence.
- Establish the Step Status table from kickoff so status never silently drifts from implementation reality.

Exit: the Phase 17 branch and fixed implementation plan exist; no Party business behavior is introduced.

Status: Completed

Evidence:
- Confirmed `main` at `044fcdc0dd42ffdb435c0b36277b148cf70afb31` (`docs: finalize phase 16 release preparation`).
- Created branch `phase/17-parties` from that exact SHA.
- Created this fixed plan with all 20 steps, explicit scope boundaries, and Argin Bridge/future synchronization constraints.

### Step 2 — Party Domain Model and Classification
- Define the Party aggregate root and durable identity.
- Define natural-person and legal-entity classification without duplicating Party records.
- Define core name/title, status, code/display number, company ownership/scope, and invariant boundaries.
- Keep infrastructure/persistence concerns out of Domain contracts.

Exit: the Party aggregate and classification model are explicit and covered by focused Domain tests.

Status: Not started

### Step 3 — Party Roles and Lifecycle
- Define reusable roles such as Customer, Supplier, and future-compatible additional roles.
- Allow one Party to hold multiple roles simultaneously.
- Define activation/deactivation and safe role add/remove semantics.
- Define duplicate/merge boundaries without implementing destructive merge unless explicitly required.

Exit: role and lifecycle rules prevent duplicated Customer/Supplier master records and invalid transitions.

Status: Not started

### Step 4 — Identity, Registration, and Tax Information
- Model Iranian national ID, legal national identifier, registration number, economic/tax identifiers, and related metadata.
- Define normalization and validation rules with clear optionality by Party type.
- Avoid coupling to the later Iranian Taxpayer System submission model while preserving compatible master data.

Exit: identity/tax attributes and validations are deterministic and type-aware.

Status: Not started

### Step 5 — Contacts and Addresses
- Define phone, mobile, email, website, contact-person, and address value/child models.
- Support multiple addresses and contacts with explicit defaults/purposes where needed.
- Define Iranian postal/address fields without hard-coding UI formatting into Domain logic.

Exit: Party contact/address information is normalized, reusable, and persistence-neutral.

Status: Not started

### Step 6 — Application and Repository Contracts
- Define Commands, Queries, DTOs, readers/repositories, paging, sorting, filtering, lookup, and selector contracts.
- Define Unit of Work and stable Application errors.
- Keep contracts compatible with future SQLite, PostgreSQL, HTTP, and bridge adapters.

Exit: Party capabilities are consumable without React, Tauri, SQLite, or HTTP dependencies.

Status: Not started

### Step 7 — Application Services and Duplicate Detection
- Implement create/update/activate/deactivate and role-management use cases.
- Implement duplicate-candidate detection using normalized identifiers and justified business fields.
- Distinguish hard uniqueness violations from advisory duplicate matches.
- Preserve idempotent integration boundaries where requests may be retried later.

Exit: Party Application behavior is deterministic, authorization-ready, and duplicate-safe.

Status: Not started

### Step 8 — Migration, Schema, and Indexing
- Add versioned SQLite migrations for Party, roles, contacts, addresses, and required metadata.
- Add unique constraints and search indexes only where supported by domain rules and expected query shapes.
- Preserve stable ID/concurrency/tombstone-compatible fields needed for future synchronization.

Exit: schema and migrations faithfully represent the accepted model and can be upgraded deterministically.

Status: Not started

### Step 9 — SQLite Repository and Atomic Transactions
- Implement SQLite repository/read adapters and Unit of Work integration.
- Guarantee atomic multi-table Party writes.
- Enforce optimistic concurrency and deterministic error mapping.
- Avoid N+1 behavior and unbounded in-memory loading.

Exit: SQLite persistence matches Application semantics with focused repository tests.

Status: Not started

### Step 10 — Argin Bridge and Future Synchronization Contract
- Formalize stable cross-database Party identity and display-number separation.
- Formalize version/change metadata, tombstone-compatible deletion lifecycle, source/external references, and retry/idempotency boundaries.
- Define persistence-neutral sync-facing DTO/boundary contracts only where necessary to protect future compatibility.
- Explicitly document what remains deferred to Phase 45.

Exit: future Argin Bridge/PostgreSQL synchronization can be added without redesigning Party identity or breaking current SQLite/Desktop behavior.

Status: Not started

### Step 11 — Permissions, Audit, and Approval Integration
- Add granular Party view/create/update/status/import/export permissions.
- Enforce company scope and permissions at the Application boundary.
- Emit audit events with actor/correlation/context for sensitive mutations.
- Integrate Approval only for operations justified by existing approval architecture; do not invent unnecessary approval workflows.

Exit: security and audit behavior do not depend on UI visibility and do not leak cross-scope Party data.

Status: Not started

### Step 12 — Bulk Import and Export
- Support professional Excel/CSV import with preview, column mapping where justified, normalization, validation, and duplicate reporting.
- Support atomic import mode so invalid batches cannot leave partial master data.
- Provide export without moving business logic into spreadsheet adapters.

Exit: large Party master sets can be transferred safely and diagnostically.

Status: Not started

### Step 13 — Persian RTL Party Management UI
- Build list/search/filter/detail/create/edit Party surfaces using the Phase 14 design system.
- Use compact desktop-friendly tables and forms.
- Provide loading, empty, error, keyboard, focus, accessibility, responsive, and display-density behavior.
- Present Persian labels and appropriate Solar Hijri dates while keeping durable timestamps Gregorian internally.

Exit: Party management is usable as a professional Persian desktop Master Data workspace.

Status: Not started

### Step 14 — Party Selector and Future Module Consumption Contract
- Provide reusable Party lookup/selector UI and Application contracts.
- Support filtering by role/status/company without coupling to Sales, Purchases, Treasury, or Inventory implementations.
- Return stable identifiers and display metadata needed by future documents.

Exit: later operational modules can consume Party selection without cloning Party logic or UI.

Status: Not started

### Step 15 — Shared Platform and Accounting Integration
- Integrate Company scope, shared query infrastructure, metadata, notifications/events, concurrency, and existing platform contracts where appropriate.
- Confirm no accounting balances/posting logic are incorrectly introduced into Party Master Data.
- Confirm future dimension/account/document references can use stable Party identity without reverse coupling.

Exit: Party fits the existing architecture cleanly without violating bounded responsibilities.

Status: Not started

### Step 16 — Domain and Application Tests
- Cover aggregate invariants, Party types, roles, lifecycle, identity validation, contacts/addresses, duplicate detection, Application errors, idempotent boundaries, authorization behavior, and optimistic concurrency contracts.

Exit: core Party semantics are comprehensively validated independent of SQLite/Desktop.

Status: Not started

### Step 17 — Repository, Migration, Import, and Desktop Tests
- Cover migrations, SQLite constraints/indexes, repository queries, atomic rollback, concurrency, bulk import/export, selector behavior, and Desktop regression states.
- Verify security boundaries remain enforced outside UI.

Exit: infrastructure and Desktop integration are green with focused regression coverage.

Status: Not started

### Step 18 — Monorepo, Performance, Accessibility, and Quality Validation
- Validate representative larger Party datasets and search/query plans.
- Validate paging/filtering avoids unbounded loading and N+1 behavior.
- Validate keyboard/accessibility/RTL/density behavior.
- Run required focused and complete repository typecheck/test/build/lint validation and record evidence.

Exit: focused and monorepo validation is green with performance and UI-quality evidence.

Status: Not started

### Step 19 — Documentation, ADR, and Validation Evidence
- Complete the Phase 17 implementation document.
- Add/update ADRs for Party identity, role model, or bridge/synchronization compatibility decisions that meet ADR threshold.
- Update database/security/architecture/glossary/canonical docs affected by the phase.
- Record migrations, permissions, test matrix, validation evidence, and verify internal links.

Exit: Phase 17 satisfies permanent Documentation Governance with no undocumented public contract or architectural decision.

Status: Not started

### Step 20 — Final Review, Merge, and Release
- Reconcile Step Status with actual evidence; no stale statuses are allowed.
- Update `ROADMAP.md`, `CHANGELOG.md`, phase index/readmes, and release checklist as required.
- Review diff for scope creep, architectural regressions, security issues, and undocumented changes.
- Merge according to repository branch strategy and prepare/create the semantic Phase 17 release as authorized.

Exit: Phase 17 is merged, documented, and released according to project governance; Phase 18 can start from a clean canonical baseline.

Status: Not started

## Change Requests

None.

Any requested change to the frozen sequence, titles, scope, or architectural commitments must be recorded here before implementation.

## Step 1 Validation

Step 1 is documentation/branch setup only. No code behavior was added, so no package test/build run is required for this step. Repository validation begins with implementation-bearing steps and is mandatory before phase completion.
