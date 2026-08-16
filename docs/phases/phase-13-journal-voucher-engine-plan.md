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

- Phase 12 was merged and released as `v0.12.0` before Phase 13 implementation began.
- `phase/13-journal-voucher-engine` was created from the released baseline.
- Frozen plan published in commit `29c7728`.

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

- Added and accepted `ADR-0013 — Journal Voucher Engine Architecture`.
- Fixed `JournalVoucher` as aggregate root owning ordered `JournalLine` entities and normalized line-dimension assignments.
- Fixed Phase 13 to Draft-only behavior and deferred posting/approval/locking/reversal/replacement/voiding/controlled amendment to Phase 14.
- Initial architecture work published through `6b30ac6` and `7551031`; ADR was synchronized again in Step 17 with the delivered pre-UoW Number Series reservation behavior.

### Step 3 — Journal Voucher Aggregate and Value Objects

- Implement voucher identity, number/reference, company/branch, voucher date, fiscal context, description, source metadata, version, and timestamps.
- Implement line identity, ordering, description, debit/credit representation and account reference.
- Enforce aggregate-level structural and balance invariants independent from persistence/UI.

Exit criteria:

- Invalid debit/credit combinations, unbalanced vouchers, duplicate/invalid ordering, and structurally invalid vouchers are rejected by focused domain tests.

Status: Completed

Evidence:

- Added stable Journal Voucher/Line identities, normalized text/date/currency/source metadata, version/timestamps, immutable ordered lines, and Draft-only status.
- Enforced minimum effective lines, exactly one positive side, safe integer amounts, unique positive ordering, deterministic sorting, and exact balance.
- Focused Domain coverage published with `2e4eeba` and status synchronized by `5058e81`.

### Step 4 — Account Eligibility and Fiscal Validation Policy

- Validate account existence, company scope, active state, postable state, and validity for journal use.
- Resolve and validate fiscal year/period from voucher date and company context.
- Reject closed/ineligible fiscal context according to existing contracts without implementing Phase 14 lifecycle behavior.

Exit criteria:

- Account/fiscal eligibility is deterministic and testable outside UI/persistence.

Status: Completed

Evidence:

- Added deterministic account/fiscal policy covering company scope, active posting-enabled Subsidiary accounts, open fiscal year/period, ownership, and date containment.
- Focused implementation/tests published through `06a57cb`, `d09beac`, and `2404b73`.

### Step 5 — Dimension Assignment Integration

- Integrate Phase 11 assignment validator and dynamic dimension requirements for each journal line.
- Validate required/optional/forbidden dimension assignments, member activity, type compatibility and scope.
- Preserve assignments as stable references suitable for future reporting and synchronization.

Exit criteria:

- Every journal line can be validated against account-dimension policy with focused success/failure coverage.

Status: Completed

Evidence:

- Reused the Phase 11 assignment validator as the authoritative rules engine and added Journal line context to validation issues.
- Covered required/optional/forbidden policies, type/member activity and validity, company/type mismatch, multiplicity, duplicates, and aggregated line-scoped failures.
- Published through `b37d8d6`, `b9a69f0`, `71583b0`, and `9f2ac3a`.

### Step 6 — Number Series and Voucher Numbering

- Define the Journal Voucher Number Series entity/type and branch/company scoping rules.
- Allocate numbers through Phase 09 Number Series contracts at the application boundary.
- Define retry, uniqueness, manual reference, and display semantics without coupling the domain to a database sequence.

Exit criteria:

- Concurrent/retried creation cannot produce duplicate committed voucher numbers.

Status: Completed

Evidence:

- Added `accounting.journal-voucher` Number Series with company + fiscal year + optional branch scope and six-digit formatting.
- Covered scope isolation, branchless scope, concurrency, retry allocation, and validation.
- Published through `b4c5487`, `72f71ce`, and `4348f82`.

### Step 7 — Application Contracts, Commands, and Queries

- Define voucher repository, usage query, Unit of Work, authorization, clock, identifier and event boundaries.
- Add create/update/delete-draft/get/list/search command/query contracts and DTOs within the Phase 13 lifecycle boundary.
- Add deterministic validation orchestration and error contracts suitable for Persian presentation.

Exit criteria:

- Application contracts are persistence-neutral and support SQLite now plus PostgreSQL/API adapters later.

Status: Completed

Evidence:

- Added persistence-neutral repository/runtime ports, mutation/query DTOs, stable Application errors, and normalized search semantics.
- Public Journal contracts remain transport/persistence independent.
- Published through `2584a73`, `137d66d`, `b756480`, `83a640d`, `51baacf`, `11c6b94`, and plan completion `7812d7f`.

### Step 8 — Journal Usage Detection and Integrity Guards

- Replace placeholder account/dimension usage assumptions with journal-backed usage queries.
- Prevent destructive account/dimension operations when journal lines reference them according to existing Phase 10/11 integrity contracts.
- Keep usage detection query-oriented and free from UI dependencies.

Exit criteria:

- Account and dimension integrity checks are backed by persisted journal references.
- Phase 10/11 regression behavior remains valid.

Status: Completed

Evidence:

- Added Journal-backed account and accounting-dimension usage readers while preserving existing fallback/structural usage contracts.
- Published through `06d800d`, `6dc8d3e`, `5b01ffb`, and status commit `5e08efe`.

### Step 9 — SQLite Migration

- Add the next versioned migration for journal vouchers, lines and line-dimension assignments.
- Add uniqueness, foreign-key, company/branch/fiscal scope, ordering, amount, version and referential constraints where enforceable.
- Add query/reporting/synchronization-oriented indexes.

Exit criteria:

- Migration succeeds from a fresh database and an upgraded Phase 12 database.
- Durable constraints align with domain invariants without embedding application-only policy in SQLite.

Status: Completed

Evidence:

- Added and registered `0013_journal_vouchers.sql` with `journal_vouchers`, `journal_lines`, and `journal_line_dimension_assignments`.
- Added durable scope, uniqueness, request-id, amount/side, foreign-key, optimistic-version, and query/usage indexes.
- Corrected branchless number uniqueness through normalized `NULL` expression index semantics.
- Published through `6bd63bd`, `e1647da`, `0747997`, `e4decec`, and `4852462`.

### Step 10 — SQLite Repositories and Unit of Work

- Implement voucher aggregate persistence, line and dimension mapping persistence, paged queries, and usage detection adapters.
- Rehydrate aggregates without bypassing invariants.
- Enforce optimistic concurrency and atomic multi-table writes using the accounting Unit of Work.

Exit criteria:

- Repository contract, transaction rollback, stale-version, query escaping, and aggregate round-trip tests pass.

Status: Completed

Evidence:

- Added SQLite Journal repository, invariant-safe rehydration, usage reader, public Journal package surface, and transaction-scoped Journal Unit of Work.
- Covered aggregate/line/dimension persistence, escaped search, optimistic concurrency, persisted usage, and rollback propagation.
- Step 16 later hardened rehydration to reject persisted header-total drift.
- Core Step 10 completion recorded in `73991ea` after the implementation/test commit series.

### Step 11 — Create/Update/Delete Draft Use Cases

- Implement authorized voucher creation with numbering and atomic persistence.
- Implement validated draft updates with optimistic concurrency.
- Implement safe draft deletion within Phase 13 lifecycle rules.
- Ensure retries/failures do not leave partial lines or assignments.

Exit criteria:

- Core mutation flows are atomic, deterministic, authorized, and fully tested.

Status: Completed

Evidence:

- Added authorized create/update/delete Draft use cases, deterministic validation orchestration, optimistic concurrency, and Journal Unit of Work integration.
- Added durable `(companyId, requestId)` create idempotency and replay behavior.
- Final desktop integration reserves Number Series before the Journal write UoW so nested Tauri transactions are avoided; consumed reservations are intentionally not reused after later rollback.
- Published through the Step 11 commit series ending in `ff89cac`.

### Step 12 — Read Models, Search, and Voucher Detail

- Implement paged list/search/filter queries by number, date range, account, branch, fiscal context and source/reference where supported.
- Implement voucher detail projection including lines and dimension assignments.
- Keep read models independent from React and SQLite-specific public contracts.

Exit criteria:

- Query behavior is deterministic, escaped, paged, and covered by focused tests.

Status: Completed

Evidence:

- Added persistence-neutral detail/list projections plus authorized get/list/search Application queries over normalized filters.
- Covered company isolation, pagination, branchless scope, supported filters, invalid date ranges, and dimension detail projection.
- Published through `44d3f77`, `388e4cf`, `5e420da`, `cd877d1`, and status commit `d68b255`.

### Step 13 — Permissions, Audit, and Integration Events

- Add permissions for voucher view, create, update draft, delete draft and relevant history/detail access.
- Enforce authorization at the application boundary.
- Record audit evidence for successful mutations and rejected sensitive operations as required by project policy.
- Emit success integration events only after commit with actor, company, branch, correlation, causation, voucher and version context.

Exit criteria:

- Sensitive operations cannot bypass authorization.
- Rollback/failure emits no success event.

Status: Completed

Evidence:

- Added `accounting.journal-vouchers.view/create/update-draft/delete-draft/view-history` permissions and enforced read/mutation authorization at the Application boundary.
- Added created/draft-updated/draft-deleted success events and authorization-denied security audit events.
- Success events publish only after commit and idempotent replay does not duplicate created events.
- Published through the Step 13 commit series ending in `00b522d`.

### Step 14 — Desktop Composition and Persian RTL UI

- Wire Phase 13 services/repositories into desktop composition.
- Add Persian RTL voucher list, create/edit form and detail view.
- Add balanced debit/credit totals, line editor, account selector and Phase 11 dynamic dimension selectors.
- Present Solar Hijri dates and Iranian Rial amounts while persisting canonical values.
- Surface actionable business errors separately from technical diagnostics.

Exit criteria:

- UI cannot bypass domain/application validation, authorization, numbering, or Unit of Work.
- Existing Chart of Accounts, Dimensions, and Coding Templates workspaces remain functional.

Status: Completed

Evidence:

- Added Desktop composition over portable Journal use cases and SQLite adapters, Journal-backed usage composition, exact-scope Number Series adapter, permissions, presenter helpers, and `/accounting/journal-vouchers` navigation/workspace.
- Initial functional UI was completed in `028a589`, then reopened for UX completeness after review.
- Rebuilt the workspace into a real Persian RTL journal-entry table with structured document information, live totals/balance state, dynamic Phase 11 dimension columns, and contained horizontal overflow.
- UI refinement commits include `6c8710f`, `8dc3bf3`, `8d22105`, `b38e765`, and final local test-label correction `e419deb`.
- No Phase 14 posting/finalization behavior was introduced.

### Step 15 — Domain and Application Test Completion

- Complete aggregate, balance, account/fiscal, dimensions, numbering, authorization, idempotency/retry and application orchestration tests.
- Cover malformed, unbalanced, cross-company, closed-period, inactive/non-postable account, missing dimension and stale-version paths.

Exit criteria:

- Critical Domain/Application success and failure paths have recorded passing evidence.

Status: Completed

Evidence:

- Consolidated existing aggregate, balance, eligibility, dimension, numbering, authorization, retry/idempotency, rollback, read authorization, and stale-version coverage.
- Added `journal-voucher-application-edge-cases.test.ts` for locked fiscal period, inactive/non-postable account, unbalanced Application mapping, missing required dimension, and cross-company update/delete protection.
- Edge coverage published in `6d15d80` and fixture typing corrected in `aef297d`.
- Repository owner executed `pnpm --filter @argin/accounting typecheck` and `pnpm --filter @argin/accounting test` locally and confirmed the Step 15 validation passing before Step 17.

### Step 16 — Persistence, Migration, Desktop, and Regression Tests

- Complete migration upgrade/fresh tests, repository contracts, transaction rollback, concurrency, usage detection, presenter/UI and desktop composition tests.
- Re-run Phase 10, 11 and 12 regression suites affected by journal-backed usage detection.

Exit criteria:

- Persistence/Desktop suites and affected prior-phase regressions pass with recorded counts.

Status: Completed

Evidence:

- Hardened repository integrity so rehydration rejects persisted header debit/credit totals that drift from totals reconstructed from lines (`f7de09e`, `32971fe`).
- Extended migration regression coverage for branchless number uniqueness, request-id uniqueness, and child cascade behavior (`563c4b1`).
- Added Journal Desktop UI regression contract covering document information, real journal table, dynamic dimension columns, totals/balance labels, and table-contained horizontal overflow (`6ab8467`, `c67a01f`).
- Final Desktop test expectation was corrected on the repository owner's local machine and pushed as `e419deb` after the test suite identified the summary-label mismatch.
- Repository owner executed the Step 16 focused commands locally: Accounting Tauri typecheck/tests, Security typecheck, Desktop typecheck/tests/build, including affected Phase 10/11/12 regression suites, and confirmed them passing.

### Step 17 — Documentation and Monorepo Validation

- Add final Phase 13 implementation record and update ADR, roadmap/current target, changelog, phase/docs indexes, database dictionary, security model, glossary and accounting-engine documentation.
- Run frozen install, lint, typecheck, all tests, production build and `git diff --check`.
- Verify internal documentation links and review delivered diff against all frozen steps.

Exit criteria:

- Documentation matches implementation.
- Full validation passes and evidence is recorded.

Status: Completed

Evidence:

- Added `docs/phases/phase-13-journal-voucher-engine.md` as the final implementation record.
- Updated ADR-0013 to the delivered architecture, including pre-Journal-UoW Number Series reservation and intentional number-gap semantics.
- Corrected root/documentation roadmap state so Phase 13 is the current closure target and Phase 14 remains planned until explicit release approval.
- Updated `CHANGELOG.md`, repository/documentation hubs, phase index, generated docs index, ADR index/registry, database dictionary, security model, domain glossary, and accounting-engine documentation.
- Internal links for the new Phase 13 implementation record and ADR references were checked against repository paths during the documentation update.
- Repository owner executed `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` on the Step 17 documentation HEAD and confirmed all commands passing.
- `node scripts/generate-doc-index.mjs` generated 73 entries and `git diff --exit-code -- docs/index.md` confirmed the generated index was current.
- `git diff --check` passed and `git status --short` was empty after restoring the incidental local Corepack `packageManager` version change, confirming a clean validated working tree.

### Step 18 — Final Review, Merge, and Release

- Review all step evidence and unresolved Change Requests.
- Confirm no Phase 14 lifecycle behavior leaked into Phase 13.
- Merge the Phase 13 branch according to project branch strategy only after explicit approval.
- Release to `main`, tag consistently as `v0.13.0`, prepare release notes, and advance the roadmap target to Phase 14 only after explicit approval.

Exit criteria:

- Phase 13 is merged and released through the approved workflow.
- Remote refs/tag and release documentation are verified.

Status: Not started

## Step Status

| Step | Title | Status |
|---:|---|---|
| 1 | Baseline, Branch, and Frozen Plan | Completed |
| 2 | Domain Analysis and ADR | Completed |
| 3 | Journal Voucher Aggregate and Value Objects | Completed |
| 4 | Account Eligibility and Fiscal Validation Policy | Completed |
| 5 | Dimension Assignment Integration | Completed |
| 6 | Number Series and Voucher Numbering | Completed |
| 7 | Application Contracts, Commands, and Queries | Completed |
| 8 | Journal Usage Detection and Integrity Guards | Completed |
| 9 | SQLite Migration | Completed |
| 10 | SQLite Repositories and Unit of Work | Completed |
| 11 | Create/Update/Delete Draft Use Cases | Completed |
| 12 | Read Models, Search, and Voucher Detail | Completed |
| 13 | Permissions, Audit, and Integration Events | Completed |
| 14 | Desktop Composition and Persian RTL UI | Completed |
| 15 | Domain and Application Test Completion | Completed |
| 16 | Persistence, Migration, Desktop, and Regression Tests | Completed |
| 17 | Documentation and Monorepo Validation | Completed |
| 18 | Final Review, Merge, and Release | Not started |

## Change Requests

None.
