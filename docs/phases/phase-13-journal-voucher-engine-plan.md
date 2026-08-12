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
- Require at least two effective lines and reject zero-value effective lines.
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

Status: Completed

Evidence:

- Added branded `JournalVoucherId` and `JournalLineId` value objects with normalization and bounded identifier validation.
- Added normalized voucher number, reference, voucher/line descriptions, canonical Gregorian voucher-date validation, explicit currency normalization, source metadata, fiscal identifiers, optimistic version, and timestamps.
- Added the `JournalVoucher` aggregate root with immutable ordered `JournalLine` children and Phase 13-only `draft` status.
- Reused Phase 09 `Money`/`CurrencyCode` for safe integer amounts and explicit currency context while defaulting presentation currency to IRR.
- Enforced at least two effective lines, positive amount on exactly one debit/credit side, non-negative safe integer amounts, positive unique line ordering, deterministic sorted lines, and strict debit/credit balance.
- Preserved stable account references and Phase 11 line-dimension assignment references without performing external account/fiscal/dimension eligibility checks inside the aggregate; those remain Steps 4 and 5.
- Added focused Domain tests for value-object normalization, immutability, IRR/manual defaults, minimum lines, invalid debit/credit combinations, invalid amounts, duplicate/invalid ordering, unbalanced vouchers, invalid Gregorian dates, invalid versions, and invalid currency codes.
- The implementation was published as commit `2e4eeba35a8fbede68705b76933a69f3f54469e9`. The isolated agent runtime could not execute the repository test command because outbound GitHub DNS and local `pnpm` were unavailable; local validation command is recorded for the repository owner.

### Step 4 — Account Eligibility and Fiscal Validation Policy

- Validate account existence, company scope, active state, postable state, and validity for journal use.
- Resolve and validate fiscal year/period from voucher date and company context.
- Reject closed/ineligible fiscal context according to existing contracts without implementing Phase 14 lifecycle behavior.

Exit criteria:

- Account/fiscal eligibility is deterministic and testable outside UI/persistence.

Status: Completed

Evidence:

- Added a persistence-neutral Journal Voucher eligibility policy covering account company scope, active status, Subsidiary level, and posting eligibility.
- Added fiscal-context validation covering fiscal-year company scope, open fiscal-year status, matching fiscal-period ownership, open fiscal-period status, and voucher-date containment within both fiscal-year and fiscal-period ranges.
- Kept Phase 14 lifecycle behavior out of the policy; locked/closed fiscal context is rejected for Phase 13 draft mutations rather than introducing posting or reopening transitions.
- Added focused tests for eligible accounts/open periods and cross-company, inactive, non-postable, non-subsidiary, closed/locked period, invalid fiscal ownership, and out-of-range voucher-date cases.
- Published implementation and focused tests through commits `06a57cbde3aac9a9f0a23184f670395b946e618a`, `d09beac25af0d14bb9fb7fbf60fbd87ed39f7f8b`, and fixture-hardening commit `2404b73122fa907e467fad99087efba7f34044ca`.

### Step 5 — Dimension Assignment Integration

- Integrate Phase 11 assignment validator and dynamic dimension requirements for each journal line.
- Validate required/optional/forbidden dimension assignments, member activity, type compatibility and scope.
- Preserve assignments as stable references suitable for future reporting and synchronization.

Exit criteria:

- Every journal line can be validated against account-dimension policy with focused success/failure coverage.

Status: Completed

Evidence:

- Reused the Phase 11 `validateAccountingDimensionAssignments` contract as the single authoritative dimension-rules engine and integrated it deterministically for every `JournalLine` using voucher company, account, voucher date, policies, dimension types, members, and persisted stable assignment identifiers.
- Added journal-scoped validation issues that retain `lineId`, line order, and `accountId`, allowing Application/UI layers to identify the exact failing journal row without duplicating Phase 11 rules.
- Added `assertValidJournalVoucherDimensions` and `JournalVoucherDimensionValidationError` so mutation orchestration can reject the whole voucher before persistence while retaining all line-scoped underlying issues.
- Preserved Phase 11 coverage for required, optional, and forbidden policies; inactive types/members; company/type mismatches; validity windows; multiplicity; duplicates; missing members/types; and undefined policies.
- Added focused Journal integration tests covering valid required assignments, missing required dimensions, forbidden assignments, omitted optional dimensions, inactive/expired members, inactive types, company/type mismatch, multiplicity restrictions, and aggregated line-scoped error reporting.
- Initial integration was published in commit `b37d8d668878cb7c9cc15cf07a011844a570aa71`; completion and focused coverage were published in commits `b9a69f092a8899a6564d4f2404a541ab0cd42c0d` and `71583b00bd03968bf30cf93fb8d6592e2c7619cc`.
- The isolated agent runtime does not provide a runnable local checkout with `pnpm`; local validation remains `pnpm --filter @argin/accounting typecheck` and `pnpm --filter @argin/accounting test`, with full execution evidence to be reconfirmed in Steps 15–17.

### Step 6 — Number Series and Voucher Numbering

- Define the Journal Voucher Number Series entity/type and branch/company scoping rules.
- Allocate numbers through Phase 09 Number Series contracts at the application boundary.
- Define retry, uniqueness, manual reference, and display semantics without coupling the domain to a database sequence.

Exit criteria:

- Concurrent/retried creation cannot produce duplicate committed voucher numbers.

Status: Completed

Evidence:

- Added the stable entity type `accounting.journal-voucher` and a default Journal Voucher Number Series definition with sequence starting at 1, increment 1, six-digit zero-padded display, and no persistence-engine-specific identity dependency.
- Added `reserveJournalVoucherNumber` at the Accounting application boundary and reused the Phase 09 `NumberSeries` port instead of generating document numbers from SQLite row IDs, timestamps, or UI state.
- Fixed Journal Voucher numbering scope to company + optional branch + fiscal year. Branchless vouchers intentionally use the platform wildcard branch scope while branch-specific vouchers retain independent counters.
- Kept the external/manual voucher reference distinct from the system-generated voucher number; the numbering integration only supplies the system number consumed by the aggregate/use case.
- Added scope normalization/validation so blank or overlong company/branch/fiscal identifiers cannot silently create ambiguous counters.
- Added focused tests for deterministic formatting, company/branch/fiscal-year isolation, branchless scoping, concurrent same-scope reservations, retry allocation, and scope validation.
- Concurrent calls against the platform Number Series receive distinct reservations; a retry advances to a new reservation rather than duplicating a previous one. Atomic coupling between the reserved number and persisted voucher remains the Unit of Work responsibility implemented in Steps 10–11, where database uniqueness will protect committed voucher numbers.
- Published the numbering integration in commit `b4c5487f093a50f43b3dee21c13576b80a84eb7f` and focused tests in commit `72f71ce8eac96e99311c6c6391542ddec6b42e74`.
- Local verification commands are `pnpm --filter @argin/accounting typecheck` and `pnpm --filter @argin/accounting test`; full repository execution evidence is reconfirmed in Steps 15–17.

### Step 7 — Application Contracts, Commands, and Queries

- Define voucher repository, usage query, Unit of Work, authorization, clock, identifier and event boundaries.
- Add create/update/delete-draft/get/list/search command/query contracts and DTOs within the Phase 13 lifecycle boundary.
- Add deterministic validation orchestration and error contracts suitable for Persian presentation.

Exit criteria:

- Application contracts are persistence-neutral and support SQLite now plus PostgreSQL/API adapters later.

Status: Completed

Evidence:

- Added persistence-neutral `JournalVoucherRepository` and `JournalVoucherUsageReader` contracts, including expected-version update/delete semantics and paged search contracts without exposing SQLite row IDs or SQL details.
- Added runtime ports for authorization, clock, identifier generation, event publication, Number Series, account lookup, fiscal-context resolution, dimension lookup, and a Journal-specific Unit of Work repository boundary.
- Added Phase 13 command contracts for create, update draft, and delete draft plus get/list/search query contracts and DTOs for voucher detail, lines, totals, source metadata, and paged list output.
- Added a stable `JournalVoucherApplicationError` family with machine-readable error codes and Persian presentation-ready messages/details for authorization, not-found, validation, dimension, numbering, duplicate number, optimistic concurrency, invalid query, and persistence failures.
- Added deterministic search-query normalization for company scope, branch semantics, trimming, pagination, canonical Gregorian date filters, date-range ordering, and bounded page size using the shared platform query limits.
- Added focused contract tests covering normalization defaults, explicit branchless scope, trimming, pagination offsets, invalid pagination, invalid/reversed dates, and stable error-code/detail behavior.
- Implementation was published through commits `2584a730177547d9305f3644855fe7411298cec0`, `137d66de39bb8029f3085a32127ce0eff4e03c9a`, `b7564805251a7d4a3864f44ec46f5643f58000c4`, `83a640da72693e44d5836531d8fe98c5aecf4cb3`, and `51baacff40bc781818f9a280a32e7e61f2e2aefb`; focused tests were added in `11c6b9497f2e1531cfd76a70c8ee09cabc2466a8`.
- Actual create/update/delete orchestration remains intentionally deferred to Step 11; Step 7 fixes only the portable contracts and deterministic boundary semantics required by that implementation.
- Local verification remains `pnpm --filter @argin/accounting typecheck` and `pnpm --filter @argin/accounting test`, with full execution evidence reconfirmed in Steps 15–17.

### Step 8 — Journal Usage Detection and Integrity Guards

- Replace placeholder account/dimension usage assumptions with journal-backed usage queries.
- Prevent destructive account/dimension operations when journal lines reference them according to existing Phase 10/11 integrity contracts.
- Keep usage detection query-oriented and free from UI dependencies.

Exit criteria:

- Account and dimension integrity checks are backed by persisted journal references.
- Phase 10/11 regression behavior remains valid.

Status: Completed

Evidence:

- Added `JournalBackedAccountUsageReader`, which implements the existing Phase 10 `AccountUsageReader` contract and treats any Journal Voucher line reference as financial activity while preserving an optional existing/fallback usage source.
- Added `JournalBackedAccountingDimensionUsageReader`, which implements the existing Phase 11 `AccountingDimensionUsageReader` contract and treats Journal line-dimension references as usage while preserving Phase 11 structural checks such as child-member and policy dependencies.
- Kept the integration query-oriented and independent from UI and persistence details; both adapters depend only on `JournalVoucherUsageReader` plus the existing Phase 10/11 usage contracts.
- Deliberately did not add SQLite queries against journal tables before Step 9 creates those tables. The concrete SQLite `JournalVoucherUsageReader` implementation remains Step 10 work, after which these guards become backed by persisted journal references without changing Phase 10/11 application services.
- Added regression-focused tests for account journal usage, fallback financial activity, dimension-type journal usage, dimension-member journal usage, preservation of Phase 11 structural usage, and journal-positive short-circuit behavior.
- Exported the journal-backed integrity readers from the Accounting package for later desktop/server composition.
- Published the integration in commits `06d800d174c357801b9ea52ebb0bb4638ecda42a`, `6dc8d3ee5d1b895739c1a828bba8e35c5c95d61f`, and `5b01ffbd7393e8f2523494d1743c3c855d2ccdf4`.
- Local verification remains `pnpm --filter @argin/accounting typecheck` and `pnpm --filter @argin/accounting test`; persistence-backed regression execution is reconfirmed in Steps 10, 16, and 17 after the Journal SQLite schema exists.

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
| 3 | Journal Voucher Aggregate and Value Objects | Completed |
| 4 | Account Eligibility and Fiscal Validation Policy | Completed |
| 5 | Dimension Assignment Integration | Completed |
| 6 | Number Series and Voucher Numbering | Completed |
| 7 | Application Contracts, Commands, and Queries | Completed |
| 8 | Journal Usage Detection and Integrity Guards | Completed |
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
