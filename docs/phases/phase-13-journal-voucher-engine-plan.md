# Phase 13 — Journal Voucher Engine: Fixed Implementation Plan

## Status

Approved baseline and implementation started. This document is the canonical execution checklist for Phase 13.

## Governance Rule

This plan is frozen for the duration of Phase 13.

Before starting every step:

1. Read this document.
2. Read the permanent `docs/development/github-publishing-workflow.md`.
3. Confirm the current branch and latest commit.
4. Confirm the previous step's exit criteria.
5. State the current step number, scope, files expected to change, and validation commands.
6. Update only status and evidence sections unless an explicit change request is approved.

A step may not be reordered, split, merged, removed, renamed, or expanded without explicit user approval. Newly discovered work must be recorded under **Change Requests** and must not silently alter the sequence.

## Phase Objective

Deliver the persisted double-entry Journal Voucher Engine that becomes the accounting source of truth for ArginAccounting. Phase 13 introduces journal voucher and line domain models, deterministic validation, numbering, accounting-dimension assignment, SQLite persistence, application services, authorization, audit/integration events, Persian RTL entry UI, and journal-backed account/dimension usage detection while deliberately leaving posting lifecycle transitions to Phase 14.

## Design Baseline

- Preserve strict double-entry balance: total debit equals total credit.
- Represent direction through mutually exclusive debit/credit amounts; never allow both on one line.
- Require at least two effective journal lines and reject zero-value effective lines.
- Validate active/postable accounts, company/branch scope, voucher date, fiscal year/period eligibility, and account-dimension requirements.
- Keep durable dates/timestamps Gregorian ISO; present dates as Solar Hijri in Persian UI.
- Use Iranian Rial as the default presentation currency while keeping currency/exchange-rate contracts explicit for future multi-currency work.
- Use stable opaque identifiers and optimistic concurrency.
- Keep Domain/Application independent from React, Tauri, SQLite, PostgreSQL, and transport protocols.
- Treat Phase 13 vouchers as editable accounting records only within the lifecycle boundary defined for this phase; final posting/approval/reversal lifecycle belongs to Phase 14.
- Preserve source/correlation/causation metadata required for future source-document posting and synchronization.

## Argin Bridge Constraints

- Local-first desktop operation through Tauri and SQLite.
- Future company-network deployment through .NET API and PostgreSQL.
- Future offline synchronization without SQLite-only domain behavior.
- Explicit company and branch scope.
- Retry-safe commands with request/idempotency identifiers where multi-write behavior is involved.
- Atomic writes behind Unit of Work boundaries.
- Post-commit integration events only after successful commit.
- Persistence models must be portable to a server-side relational implementation.

## Scope

### Included

- Journal Voucher aggregate and Journal Line entity/value objects
- Manual/accounting-origin voucher source metadata
- Voucher date, fiscal year, fiscal period, company, branch, description, reference and sequence number
- Debit/credit and balance invariants
- Account eligibility validation
- Accounting Dimension assignment validation using Phase 11 contracts
- Number Series integration using Phase 09 infrastructure
- Application commands/queries and DTOs
- SQLite migration and repositories
- Atomic Unit of Work behavior and optimistic concurrency
- Permissions, audit evidence, and integration events
- Journal-backed account/dimension usage detection
- Persian RTL desktop voucher entry/list/detail experience
- Domain, application, persistence, migration, permission, presenter/UI, regression, and full monorepo validation

### Excluded

- Final post/unpost lifecycle, approval workflow, locking, reversal and controlled amendment (Phase 14)
- Trial balance, general ledger, subsidiary ledger and financial reporting (Phase 15)
- Automatic posting from Sales, Purchase, Inventory, Treasury, Payroll, or Tax modules
- Foreign-exchange gain/loss realization
- PostgreSQL/server API and synchronization implementation
- Destructive account/dimension remapping for existing journal usage

## Fixed Execution Sequence

### Step 1 — Baseline, Branch, and Frozen Plan

- Create `phase/13-journal-voucher-engine` from released Phase 12 on `main`.
- Record Phase 09–12 dependencies and current migration, accounting, permissions, events, UI, and test baselines.
- Freeze this implementation plan before implementation changes.
- Verify Phase 12 is merged/released and Phase 13 is the canonical current target.

Exit criteria:

- Branch starts from released Phase 12 baseline.
- This file is committed on the Phase 13 branch.
- Dependencies and boundaries are explicit.

Status: Completed

Evidence:

- Phase 12 is merged to `main`; repository roadmap identifies Phase 13 — Journal Voucher Engine as the current implementation target.
- Created `phase/13-journal-voucher-engine` from current `main`.
- Frozen Phase 13 scope, architecture boundaries, Argin Bridge constraints, execution sequence, and exit criteria in this canonical plan.

### Step 2 — Domain Analysis and ADR

- Reconcile accounting-engine invariants with Phase 09 Money/Number Series, Phase 10 Accounts, Phase 11 Dimensions, Phase 12 provenance, Company/Branch and Fiscal Period contracts.
- Define aggregate boundary, voucher statuses available in Phase 13, source/reference semantics, numbering semantics, currency representation, edit rules, and lifecycle handoff to Phase 14.
- Define rejected alternatives and portability/synchronization constraints.
- Add ADR-0013.

Exit criteria:

- Aggregate ownership and invariants are unambiguous.
- Phase 13/14 boundary is explicit and prevents lifecycle leakage.

Status: Completed

Evidence:

- Added `ADR-0013 — Journal Voucher Engine Architecture` and reconciled the journal design with the existing Accounting Engine, Phase 09 Number Series/transaction/concurrency/event contracts, Phase 10 account eligibility model, Phase 11 reusable dimension assignment validator, Phase 12 provenance patterns, and existing company/branch/fiscal contracts.
- Fixed `JournalVoucher` as the aggregate root owning ordered `JournalLine` entities and normalized line-dimension assignments.
- Fixed Phase 13 lifecycle scope to editable `draft` vouchers only; posting, approval, locking, reversal, replacement, voiding, and controlled amendment remain Phase 14 responsibilities.
- Fixed structural invariants: at least two effective lines, exactly one positive debit/credit side per line, no zero effective lines, deterministic unique ordering, and total debit equal to total credit.
- Fixed Application-boundary validation for posting-enabled active subsidiary accounts, company scope, open fiscal context, Phase 11 dimension policies, Number Series reservation, optimistic concurrency, atomic Unit of Work behavior, audit, and post-commit events.
- Fixed canonical Gregorian durable dates with Solar Hijri presentation, Iranian Rial default presentation with explicit currency context, stable opaque identifiers, source/correlation/causation metadata, and portability rules for future PostgreSQL/.NET API/offline synchronization.
- Rejected SQLite AUTOINCREMENT business numbering, separate Journal Line aggregate ownership, duplicated dimension validation, source-module direct journal persistence, and Phase 14 lifecycle leakage.

### Step 3 — Journal Voucher Aggregate and Value Objects

- Implement voucher identity, number/reference, company/branch, voucher date, fiscal context, description, source metadata, version, and timestamps.
- Implement line identity, ordering, description, debit/credit representation and account reference.
- Enforce aggregate-level structural and balance invariants independent from persistence/UI.

Exit criteria:

- Invalid debit/credit combinations, unbalanced vouchers, duplicate/invalid ordering, and structurally invalid vouchers are rejected by focused domain tests.

### Step 4 — Account Eligibility and Fiscal Validation Policy

- Validate account existence, company scope, active state, postable state, and validity for journal use.
- Resolve and validate fiscal year/period from voucher date and company context.
- Reject closed/ineligible fiscal context according to existing contracts without implementing Phase 14 lifecycle behavior.

Exit criteria:

- Account/fiscal eligibility is deterministic and testable outside UI/persistence.

### Step 5 — Dimension Assignment Integration

- Integrate Phase 11 assignment validator and dynamic dimension requirements for each journal line.
- Validate required/optional/forbidden dimension assignments, member activity, type compatibility and scope.
- Preserve assignments as stable references suitable for future reporting and synchronization.

Exit criteria:

- Every journal line can be validated against account-dimension policy with focused success/failure coverage.

### Step 6 — Number Series and Voucher Numbering

- Define the Journal Voucher Number Series entity/type and branch/company scoping rules.
- Allocate numbers through Phase 09 Number Series contracts at the application boundary.
- Define retry, uniqueness, manual reference, and display semantics without coupling the domain to a database sequence.

Exit criteria:

- Concurrent/retried creation cannot produce duplicate committed voucher numbers.

### Step 7 — Application Contracts, Commands, and Queries

- Define voucher repository, usage query, Unit of Work, authorization, clock, identifier and event boundaries.
- Add create/update/delete-draft/get/list/search command/query contracts and DTOs within the Phase 13 lifecycle boundary.
- Add deterministic validation orchestration and error contracts suitable for Persian presentation.

Exit criteria:

- Application contracts are persistence-neutral and support SQLite now plus PostgreSQL/API adapters later.

### Step 8 — Journal Usage Detection and Integrity Guards

- Replace placeholder account/dimension usage assumptions with journal-backed usage queries.
- Prevent destructive account/dimension operations when journal lines reference them according to existing Phase 10/11 integrity contracts.
- Keep usage detection query-oriented and free from UI dependencies.

Exit criteria:

- Account and dimension integrity checks are backed by persisted journal references.
- Phase 10/11 regression behavior remains valid.

### Step 9 — SQLite Migration

- Add the next versioned migration for journal vouchers, lines and line-dimension assignments.
- Add uniqueness, foreign-key, company/branch/fiscal scope, ordering, amount, version and referential constraints where enforceable.
- Add query/reporting/synchronization-oriented indexes.

Exit criteria:

- Migration succeeds from a fresh database and an upgraded Phase 12 database.
- Durable constraints align with domain invariants without embedding application-only policy in SQLite.

### Step 10 — SQLite Repositories and Unit of Work

- Implement voucher aggregate persistence, line and dimension mapping persistence, paged queries, and usage detection adapters.
- Rehydrate aggregates without bypassing invariants.
- Enforce optimistic concurrency and atomic multi-table writes using the accounting Unit of Work.

Exit criteria:

- Repository contract, transaction rollback, stale-version, query escaping, and aggregate round-trip tests pass.

### Step 11 — Create/Update/Delete Draft Use Cases

- Implement authorized voucher creation with numbering and atomic persistence.
- Implement validated draft updates with optimistic concurrency.
- Implement safe draft deletion within Phase 13 lifecycle rules.
- Ensure retries/failures do not leave partial lines or assignments.

Exit criteria:

- Core mutation flows are atomic, deterministic, authorized, and fully tested.

### Step 12 — Read Models, Search, and Voucher Detail

- Implement paged list/search/filter queries by number, date range, account, branch, fiscal context and source/reference where supported.
- Implement voucher detail projection including lines and dimension assignments.
- Keep read models independent from React and SQLite-specific public contracts.

Exit criteria:

- Query behavior is deterministic, escaped, paged, and covered by focused tests.

### Step 13 — Permissions, Audit, and Integration Events

- Add permissions for voucher view, create, update draft, delete draft and relevant history/detail access.
- Enforce authorization at the application boundary.
- Record audit evidence for successful mutations and rejected sensitive operations as required by project policy.
- Emit success integration events only after commit with actor, company, branch, correlation, causation, voucher and version context.

Exit criteria:

- Sensitive operations cannot bypass authorization.
- Rollback/failure emits no success event.

### Step 14 — Desktop Composition and Persian RTL UI

- Wire Phase 13 services/repositories into desktop composition.
- Add Persian RTL voucher list, create/edit form and detail view.
- Add balanced debit/credit totals, line editor, account selector and Phase 11 dynamic dimension selectors.
- Present Solar Hijri dates and Iranian Rial amounts while persisting canonical values.
- Surface actionable business errors separately from technical diagnostics.

Exit criteria:

- UI cannot bypass domain/application validation, authorization, numbering, or Unit of Work.
- Existing Chart of Accounts, Dimensions, and Coding Templates workspaces remain functional.

### Step 15 — Domain and Application Test Completion

- Complete aggregate, balance, account/fiscal, dimensions, numbering, authorization, idempotency/retry and application orchestration tests.
- Cover malformed, unbalanced, cross-company, closed-period, inactive/non-postable account, missing dimension and stale-version paths.

Exit criteria:

- Critical Domain/Application success and failure paths have recorded passing evidence.

### Step 16 — Persistence, Migration, Desktop, and Regression Tests

- Complete migration upgrade/fresh tests, repository contracts, transaction rollback, concurrency, usage detection, presenter/UI and desktop composition tests.
- Re-run Phase 10, 11 and 12 regression suites affected by journal-backed usage detection.

Exit criteria:

- Persistence/Desktop suites and affected prior-phase regressions pass with recorded counts.

### Step 17 — Documentation and Monorepo Validation

- Add final Phase 13 implementation record and update ADR, roadmap/current target, changelog, phase/docs indexes, database dictionary, security model, glossary and accounting-engine documentation.
- Run frozen install, lint, typecheck, all tests, production build and `git diff --check`.
- Verify internal documentation links and review delivered diff against all frozen steps.

Exit criteria:

- Documentation matches implementation.
- Full validation passes and evidence is recorded.

### Step 18 — Final Review, Merge, and Release

- Review all step evidence and unresolved Change Requests.
- Confirm no Phase 14 lifecycle behavior leaked into Phase 13.
- Merge the Phase 13 branch according to project branch strategy only after explicit approval.
- Release to `main`, tag consistently as `v0.13.0`, prepare release notes, and advance the roadmap target to Phase 14 only after explicit approval.

Exit criteria:

- Phase 13 is merged and released through the approved workflow.
- Remote refs/tag and release documentation are verified.

## Step Status

| Step | Title | Status |
|---:|---|---|
| 1 | Baseline, Branch, and Frozen Plan | Completed |
| 2 | Domain Analysis and ADR | Completed |
| 3 | Journal Voucher Aggregate and Value Objects | Not started |
| 4 | Account Eligibility and Fiscal Validation Policy | Not started |
| 5 | Dimension Assignment Integration | Not started |
| 6 | Number Series and Voucher Numbering | Not started |
| 7 | Application Contracts, Commands, and Queries | Not started |
| 8 | Journal Usage Detection and Integrity Guards | Not started |
| 9 | SQLite Migration | Not started |
| 10 | SQLite Repositories and Unit of Work | Not started |
| 11 | Create/Update/Delete Draft Use Cases | Not started |
| 12 | Read Models, Search, and Voucher Detail | Not started |
| 13 | Permissions, Audit, and Integration Events | Not started |
| 14 | Desktop Composition and Persian RTL UI | Not started |
| 15 | Domain and Application Test Completion | Not started |
| 16 | Persistence, Migration, Desktop, and Regression Tests | Not started |
| 17 | Documentation and Monorepo Validation | Not started |
| 18 | Final Review, Merge, and Release | Not started |

## Change Requests

None.
