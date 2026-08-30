# Phase 17 — Parties — Fixed Implementation Plan

## Status

Phase 17 is active. Steps 1–12 are completed. Steps 13–20 are not started.

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

Included: Party aggregate and types, natural/legal person identity, Iranian registration/tax identifiers, Party roles, lifecycle, contacts, addresses, duplicate detection, Application contracts/services, SQLite schema/repository, atomic writes, optimistic concurrency, permissions/audit integration, future Approval hooks where justified, bulk Excel/CSV import/export, Persian RTL desktop Party management, reusable Party selectors, integration boundaries for later Sales/Purchases/Treasury modules, tests, performance validation, documentation, merge, and release.

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
| 2 | Party Domain Model and Classification | Completed |
| 3 | Party Roles and Lifecycle | Completed |
| 4 | Identity, Registration, and Tax Information | Completed |
| 5 | Contacts and Addresses | Completed |
| 6 | Application and Repository Contracts | Completed |
| 7 | Application Services and Duplicate Detection | Completed |
| 8 | Migration, Schema, and Indexing | Completed |
| 9 | SQLite Repository and Atomic Transactions | Completed |
| 10 | Argin Bridge and Future Synchronization Contract | Completed |
| 11 | Permissions, Audit, and Approval Integration | Completed |
| 12 | Bulk Import and Export | Completed |
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
- Phase 17 branch was created from the accepted Phase 16 baseline and this fixed 20-step plan was established before Party implementation began.

### Step 2 — Party Domain Model and Classification
- Define the Party aggregate root and durable identity.
- Define natural-person and legal-entity classification without duplicating Party records.
- Define core name/title, status, code/display number, company ownership/scope, and invariant boundaries.
- Keep infrastructure/persistence concerns out of Domain contracts.

Exit: the Party aggregate and classification model are explicit and covered by focused Domain tests.

Status: Completed

Evidence:
- Added persistence-neutral Party aggregate, natural/legal discriminated classification, company scope, stable ID, display code, names/status/timestamps and focused Domain tests.

### Step 3 — Party Roles and Lifecycle
- Define reusable roles such as Customer, Supplier, and future-compatible additional roles.
- Allow one Party to hold multiple roles simultaneously.
- Define activation/deactivation and safe role add/remove semantics.
- Define duplicate/merge boundaries without implementing destructive merge unless explicitly required.

Exit: role and lifecycle rules prevent duplicated Customer/Supplier master records and invalid transitions.

Status: Completed

Evidence:
- Added customer/supplier multi-role semantics, immutable role/status transitions, monotonic mutation timestamps and safe merge-boundary assessment with focused tests.

### Step 4 — Identity, Registration, and Tax Information
- Model Iranian national ID, legal national identifier, registration number, economic/tax identifiers, and related metadata.
- Define normalization and validation rules with clear optionality by Party type.
- Avoid coupling to the later Iranian Taxpayer System submission model while preserving compatible master data.

Exit: identity/tax attributes and validations are deterministic and type-aware.

Status: Completed

Evidence:
- Added type-aware Iranian identity/tax value objects, digit normalization, national-code/legal-ID checksum validation and current/legacy economic-number rules with focused tests.

### Step 5 — Contacts and Addresses
- Define phone, mobile, email, website, contact-person, and address value/child models.
- Support multiple addresses and contacts with explicit defaults/purposes where needed.
- Define Iranian postal/address fields without hard-coding UI formatting into Domain logic.

Exit: Party contact/address information is normalized, reusable, and persistence-neutral.

Status: Completed

Evidence:
- Added normalized contact/address child models, multiple purposes, primary invariants, Iranian postal handling, immutable collections and focused regression tests.

### Step 6 — Application and Repository Contracts
- Define Commands, Queries, DTOs, readers/repositories, paging, sorting, filtering, lookup, and selector contracts.
- Define Unit of Work and stable Application errors.
- Keep contracts compatible with future SQLite, PostgreSQL, HTTP, and bridge adapters.

Exit: Party capabilities are consumable without React, Tauri, SQLite, or HTTP dependencies.

Status: Completed

Evidence:
- Added persistence-neutral Commands/Queries/DTOs, bounded paging/filtering/selectors, Reader/Repository separation, Unit of Work and stable Application errors.

### Step 7 — Application Services and Duplicate Detection
- Implement create/update/activate/deactivate and role-management use cases.
- Implement duplicate-candidate detection using normalized identifiers and justified business fields.
- Distinguish hard uniqueness violations from advisory duplicate matches.
- Preserve idempotent integration boundaries where requests may be retried later.

Exit: Party Application behavior is deterministic, authorization-ready, and duplicate-safe.

Status: Completed

Evidence:
- Added Party Application Service, hard/advisory duplicate assessment, immutable classification boundary, expected-version forwarding and durable-ID idempotent create replay behavior with focused tests.

### Step 8 — Migration, Schema, and Indexing
- Add versioned SQLite migrations for Party, roles, contacts, addresses, and required metadata.
- Add unique constraints and search indexes only where supported by domain rules and expected query shapes.
- Preserve stable ID/concurrency/tombstone-compatible fields needed for future synchronization.

Exit: schema and migrations faithfully represent the accepted model and can be upgraded deterministically.

Status: Completed

Evidence:
- Added migration 0016 for Party/roles/contacts/addresses with company-scoped constraints, optimistic version storage and bounded-query indexes; migration registry was reconciled through version 16.

### Step 9 — SQLite Repository and Atomic Transactions
- Implement SQLite repository/read adapters and Unit of Work integration.
- Guarantee atomic multi-table Party writes.
- Enforce optimistic concurrency and deterministic error mapping.
- Avoid N+1 behavior and unbounded in-memory loading.

Exit: SQLite persistence matches Application semantics with focused repository tests.

Status: Completed

Evidence:
- Added `@argin/party-tauri`, SQLite Party Repository/Reader/DuplicateLookup and Unit of Work with atomic multi-table writes, optimistic concurrency, stable SQLite conflict mapping and bounded SQL paging/selectors.

### Step 10 — Argin Bridge and Future Synchronization Contract
- Formalize stable cross-database Party identity and display-number separation.
- Formalize version/change metadata, tombstone-compatible deletion lifecycle, source/external references, and retry/idempotency boundaries.
- Define persistence-neutral sync-facing DTO/boundary contracts only where necessary to protect future compatibility.
- Explicitly document what remains deferred to Phase 45.

Exit: future Argin Bridge/PostgreSQL synchronization can be added without redesigning Party identity or breaking current SQLite/Desktop behavior.

Status: Completed

Evidence:
- Added Party sync envelopes, stable `(companyId, partyId)` identity, version/change metadata, tombstones, external references and migration 0017; transport, checkpoints, PostgreSQL adapter and conflict resolution remain Phase 45.

### Step 11 — Permissions, Audit, and Approval Integration
- Add granular Party view/create/update/status/import/export permissions.
- Enforce company scope and permissions at the Application boundary.
- Emit audit events with actor/correlation/context for sensitive mutations.
- Integrate Approval only for operations justified by existing approval architecture; do not invent unnecessary approval workflows.

Exit: security and audit behavior do not depend on UI visibility and do not leak cross-scope Party data.

Status: Completed

Evidence:
- Added seven granular `master-data.parties.*` permissions for view, create, update, status, role management, import and export and registered them in the shared Security default permission catalog.
- Added `SecuredPartyApplicationService` and `SecuredPartyReader`; authorization is evaluated at the Application boundary using actor/company/correlation/request context before mutation or read operations.
- Added Party audit contracts and correlation-aware audit events for create/update/status/role/import/export operations. Idempotent create replay does not emit a duplicate mutation audit event.
- Added `SharedAuditPartySink` in `@argin/party-tauri`, mapping Party events into the existing `@argin/audit` `recordAuditEntry` infrastructure with company scope, actor, target, correlation and request metadata.
- Reviewed the existing Approval architecture. Routine Party Master Data CRUD/status/role/import/export does not justify a new approval workflow, so no artificial Party-specific approval lifecycle was introduced.
- Added focused tests proving authorization runs before writes and successful mutations emit correlated audit data.

### Step 12 — Bulk Import and Export
- Support professional Excel/CSV import with preview, column mapping where justified, normalization, validation, and duplicate reporting.
- Support atomic import mode so invalid batches cannot leave partial master data.
- Provide export without moving business logic into spreadsheet adapters.

Exit: large Party master sets can be transferred safely and diagnostically.

Status: Completed

Evidence:
- Added `PartyBulkTransferService` with explicit column mapping, Persian/English classification and role normalization, Domain-driven Party/contact/address validation, database duplicate assessment and duplicate detection inside the imported batch.
- Preview reports row numbers, validation issues, hard duplicate Party IDs and advisory duplicate Party IDs before persistence.
- Atomic mode rejects invalid batches without opening a write transaction and writes a valid batch through one `PartyUnitOfWork`; non-atomic mode isolates rows and returns per-row write failures.
- Imported Contact/Address child IDs are scoped by the durable Party ID before persistence so independent imported Parties cannot collide on global SQLite child primary keys.
- Added `PartyMasterExportService` and `SqlitePartyMasterExportReader` for company-scoped, bounded page streaming of Party identity/registration, roles and primary contact/address fields without loading the full master set or Party aggregates into memory.
- Added CSV/XLSX codecs in `@argin/party-tauri`; file adapters enforce file/row/column limits and only convert tabular data while Party business validation remains in Domain/Application.
- Added summary and richer Master Data CSV/XLSX exports. Master export uses canonical column names compatible with later import mapping and includes identity, registration, roles, primary contact/address and timestamps.
- Import/export operations use the permissions and audit boundary established in Step 11.
- Added focused tests for in-file duplicate preview, zero-write invalid atomic batches, one-transaction valid atomic batches, unique imported child IDs, bounded export paging, and CSV/XLSX round trips.
- Party management screens, mapping UX and preview UI remain Step 13; full real-SQLite/import/Desktop regression coverage remains Step 17.

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

## Step 2 Validation

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
```

## Step 3 Validation

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
```

## Step 4 Validation

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
```

## Step 5 Validation

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
```

## Step 6 Validation

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
```

## Step 7 Validation

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
```

## Step 8 Validation

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/desktop typecheck
cd apps/desktop/src-tauri && cargo check
```

## Step 9 Validation

```bash
pnpm install
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/party-tauri typecheck
pnpm --filter @argin/party-tauri test
```

## Step 10 Validation

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/desktop typecheck
cd apps/desktop/src-tauri && cargo check
```

## Step 11 Validation

```bash
pnpm install
pnpm --filter @argin/security typecheck
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/party-tauri typecheck
```

Step 11 adds no Party-specific Approval workflow because the existing generic Approval capability has no justified Party Master Data transition to govern. `pnpm install` refreshes the workspace lock importer for the shared `@argin/audit` dependency.

## Step 12 Validation

```bash
pnpm install
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/party-tauri typecheck
pnpm --filter @argin/party-tauri test
```

Step 12 adds the existing repository-standard `xlsx@0.18.5` dependency to `@argin/party-tauri`; `pnpm install` must refresh the lockfile importer before frozen-lockfile CI validation. Full real-SQLite migration/import/rollback/Desktop tests remain Step 17 and complete monorepo/performance validation remains Step 18.
