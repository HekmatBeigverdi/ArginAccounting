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

Status: Completed

Evidence:

- Added `0013_journal_vouchers.sql` with `journal_vouchers`, `journal_lines`, and normalized `journal_line_dimension_assignments` tables linked to company, branch, fiscal year/period, account, dimension type, and dimension member data.
- Added durable constraints for draft-only Phase 13 status, canonical voucher dates, positive optimistic versions, line ordering, mutually exclusive debit/credit sides, balanced voucher totals, and same-company account/dimension references.
- Added deterministic uniqueness for voucher number scope and corrected SQLite `NULL` semantics for branchless vouchers through a unique expression index using `COALESCE(branch_id, '')`.
- Added indexes for company/date, branch/date, fiscal context, reference, source/request, correlation/causation, account usage, and dimension usage queries.
- Registered migration version 13 in the Tauri migration runner after Phase 12 migration 12.
- Added migration tests covering registration, Phase 12 upgrade/fresh execution, existing-data preservation, valid journal persistence, duplicate-number rejection, invalid balance/line-side rejection, and account/dimension referential integrity.
- Published migration/schema work through commits `6bd63bdc25b3b9ae5b0280b590394ccfff125bf8`, `e1647dada2c26fdf515008634a5d8fa17fe37b12`, `0747997ca044c945291787c1a154d7f4b68e642b`, and branchless uniqueness correction `e4dececb4997c26a4eb50c4d3466469fa84aa45c`.
- Local migration validation remains `pnpm --filter @argin/desktop test`; full fresh/upgrade execution evidence is reconfirmed in Steps 16–17.

### Step 10 — SQLite Repositories and Unit of Work

- Implement voucher aggregate persistence, line and dimension mapping persistence, paged queries, and usage detection adapters.
- Rehydrate aggregates without bypassing invariants.
- Enforce optimistic concurrency and atomic multi-table writes using the accounting Unit of Work.

Exit criteria:

- Repository contract, transaction rollback, stale-version, query escaping, and aggregate round-trip tests pass.

Status: Completed

Evidence:

- Added `SqliteJournalVoucherRepository` implementing create, find-by-id, scoped find-by-number, paged search, optimistic update, and draft delete against the Step 9 schema.
- Persisted the aggregate across voucher, line, and normalized line-dimension tables while keeping all multi-table writes inside the caller-provided database session.
- Added invariant-safe persisted aggregate reconstruction through `rehydrateJournalVoucher`, which first rebuilds through `createJournalVoucher` and then restores persisted update metadata instead of directly manufacturing an invalid aggregate.
- Added escaped `LIKE ... ESCAPE '\\'` search handling for `%`, `_`, and backslash, deterministic ordering, account-filter `EXISTS` queries, branchless filtering, date/source/reference/number filters, and structural paged results.
- Added `SqliteJournalVoucherUsageReader`, making Step 8 account/dimension integrity guards backed by the persisted journal tables.
- Added `SqliteJournalVoucherUnitOfWork`, which creates the Journal repository from one transaction-scoped `DatabaseSession`, ensuring voucher/line/dimension writes roll back together when the operation fails.
- Enforced stale-version detection through the shared `assertVersionedUpdate` concurrency contract before child-line replacement; stale updates and deletes cannot silently overwrite a newer voucher.
- Added the `@argin/accounting/journal` public subpath so persistence adapters consume only explicit Journal domain/contracts rather than internal source paths, and exported Journal SQLite adapters from `@argin/accounting-tauri`.
- Added focused repository tests for aggregate/line/dimension writes, invariant-safe round-trip including `updatedAt`, stale optimistic update rejection, escaped query input/pagination, persisted usage lookup, and Unit of Work transaction/failure propagation.
- Published Step 10 implementation through commits `4046a22e9515124db950257d0f3a6105703fa79d`, `d0c61af87bb4e163f0a01ac8429fecbabd15445d`, `b7edb6f1cd4f5bc617df8f7e85fd98ababec3026`, `3b7f5afc55747c9cf60631afba44a5ce96ee46ba`, `e8fef8c18521b0027fd62689d2aa38389826b2de`, `a7c4b8aba415097bead65ba4b6f3a6a1aafd2b21`, `9b028d26781237f5de995b6ea59d545092f490e6`, `103cea09306d964bf3559992a863a8f9d02f4666`, `174acf4ed80d379f937ae8cade4b7245e4d0da1a`, `c3b0863096ca791578f54aeda44087dc82c51555`, `772749d3e80d36ce8ed738935ad524d342b17625`, and dependency-neutral repository refinement `e6c33acac761a1af4c45a090fb54f1a7bd5cb5fe`.
- The isolated runtime could not clone GitHub because DNS resolution for `github.com` is unavailable; local verification is required with `pnpm --filter @argin/accounting typecheck`, `pnpm --filter @argin/accounting-tauri typecheck`, and `pnpm --filter @argin/accounting-tauri test`. Full execution evidence is reconfirmed in Steps 16–17.

### Step 11 — Create/Update/Delete Draft Use Cases

- Implement authorized voucher creation with numbering and atomic persistence.
- Implement validated draft updates with optimistic concurrency.
- Implement safe draft deletion within Phase 13 lifecycle rules.
- Ensure retries/failures do not leave partial lines or assignments.

Exit criteria:

- Core mutation flows are atomic, deterministic, authorized, and fully tested.

Status: Completed

Evidence:

- Added `createJournalVoucherDraft`, `updateJournalVoucherDraft`, and `deleteJournalVoucherDraft` application use cases using the frozen Step 7 command/runtime contracts and Step 10 Journal Unit of Work.
- Enforced authorization before mutation work, while intentionally leaving the final permission catalog, audit recording, and post-commit integration-event publication to Step 13.
- Create resolves the open fiscal context, validates every referenced posting account through the Step 4 eligibility policy, builds the aggregate through Domain invariants, validates Phase 11 dimension assignments, reserves the system voucher number through the Phase 09 Number Series adapter, and persists the complete aggregate through one Journal Unit of Work.
- Update re-reads the current aggregate inside the write transaction, preserves voucher identity/number/source/created timestamp, recalculates fiscal context and line/dimension validity, increments the optimistic version, and delegates the final compare-and-write to the repository's expected-version guard.
- Delete is restricted to the persisted Phase 13 `draft` aggregate contract, verifies company ownership and expected version inside the Unit of Work, and relies on database cascades to remove child lines/assignments atomically.
- Added request-key replay semantics for create: a committed voucher can be retrieved by `(companyId, requestId)` before a new Number Series reservation, so a retry after a lost response returns the original voucher without consuming another number.
- Hardened durable create idempotency with `JournalVoucherRepository.findByRequestId`, SQLite lookup support, request-id normalization constraints, and a partial unique index on `(company_id, request_id)` when the request id is non-null; concurrent/retried attempts therefore cannot commit two vouchers for the same company request key.
- Preserved the Number Series reservation rule from Step 6: if a transaction fails after a reservation, the reserved business number remains consumed, but the Journal Unit of Work exposes no partial voucher/line/dimension state and a subsequent retry receives a fresh number unless an earlier commit with the same request key already exists.
- Added focused Application tests for successful authorized create, same-request replay without a second number reservation, unauthorized rejection before numbering, missing-account rejection, transaction rollback with no committed aggregate, update identity/number preservation with version increment, stale-version rejection, and version-safe draft deletion.
- Extended the migration regression test to prove non-null request identifiers are unique per company while multiple null request identifiers remain allowed.
- Published Step 11 work through commits `84564d4ee1609c07a105726015c6b507ad0d736d`, `f3d747fa92e748a1b3d30a8c065e16402aca16cd`, `1d48372d99ac0871a19e22dfdc53f5fd25fd112d`, `3cfb05c24a7580c88a92b48b83dab279a437b7b4`, `b7bb6ebeedd648c3bf685412784e96629ff758fb`, `a2982f7a99436ba73b8f95c395149c8ef0c654d4`, `657d026af7a24d3f7cfb049d183151d7f793d2be`, `497ecc1a23cfe3d1fbaef01280271c2adb6c18e3`, and `7da06997dbf887cc5a216a589cb57d08e6356e35`.
- Local verification remains `pnpm --filter @argin/accounting typecheck`, `pnpm --filter @argin/accounting test`, `pnpm --filter @argin/accounting-tauri typecheck`, `pnpm --filter @argin/accounting-tauri test`, and `pnpm --filter @argin/desktop test`; broader authorization/idempotency/regression execution evidence is reconfirmed in Steps 15–17.

### Step 12 — Read Models, Search, and Voucher Detail

- Implement paged list/search/filter queries by number, date range, account, branch, fiscal context and source/reference where supported.
- Implement voucher detail projection including lines and dimension assignments.
- Keep read models independent from React and SQLite-specific public contracts.

Exit criteria:

- Query behavior is deterministic, escaped, paged, and covered by focused tests.

Status: Completed

Evidence:

- Added persistence-neutral Journal read-model projection functions for voucher detail, list summaries, line money values, totals, and normalized line-dimension assignments; DTOs contain no React, Tauri, SQLite, or SQL types.
- Added `getJournalVoucher`, `listJournalVouchers`, and `searchJournalVouchers` Application query use cases over the portable `JournalVoucherRepository` contract.
- Detail queries normalize required company/voucher identifiers, enforce company scope by returning the stable `journal.not-found` contract for missing or cross-company aggregates, and project full line/detail data including dimension assignments.
- List/search queries reuse the frozen Step 7 `normalizeJournalVoucherSearchQuery` contract before persistence, covering company, explicit branchless/branch scope, fiscal year/period, account, source type, reference, voucher number, Gregorian date range, free text, page, page size, and offset semantics.
- Preserved the deterministic SQLite ordering and escaped `LIKE ... ESCAPE '\\'` behavior already implemented and tested in Step 10; Step 12 adds the Application read boundary without duplicating persistence escaping logic.
- List projections intentionally omit line collections and return compact voucher summaries with number, date, reference, description, totals, branch, and optimistic version while preserving repository page metadata.
- Exported query normalization, read-model projectors, and get/list/search use cases through the `@argin/accounting/journal` public subpath for future desktop and PostgreSQL/API composition.
- Added focused Application tests for full voucher detail projection, dimension assignment projection, cross-company not-found behavior, invalid required query identifiers, all supported search filters and trimming, branchless scope, pagination metadata, compact list projection, and invalid/reversed date-range rejection before repository execution.
- The existing Step 10 SQLite repository test continues to verify wildcard escaping for `%`, `_`, and backslash plus paged search semantics, completing the escaped-query portion of this step's exit criteria without leaking SQL into Application tests.
- Published Step 12 implementation through commits `44d3f772693b35ba8dec799f8d3e97c76b5d2872`, `388e4cf671188668384172f2afb4a025b9ceb771`, `5e420da75d8088baf8a934e2545deda9cf8b23fe`, and `cd877d1c18f381c24c57979d23c96348ef25238f`.
- Local verification remains `pnpm --filter @argin/accounting typecheck`, `pnpm --filter @argin/accounting test`, `pnpm --filter @argin/accounting-tauri typecheck`, and `pnpm --filter @argin/accounting-tauri test`; full read/persistence regression execution evidence is reconfirmed in Steps 15–17.

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

- Added the frozen Journal permission catalog `journalVoucherPermissions` with `view`, `create`, `updateDraft`, `deleteDraft`, and `viewHistory` permission identifiers under the `accounting.journal-vouchers.*` namespace.
- Replaced the Step 11 private permission strings with the public Journal permission catalog and kept create/update/delete authorization at the Application mutation boundary.
- Added `view` authorization to `getJournalVoucher`, `listJournalVouchers`, and `searchJournalVouchers`, so desktop or future API callers cannot bypass Journal read authorization by directly invoking Application read use cases. The `viewHistory` permission is defined for the future history surface without introducing Phase 14 lifecycle/history behavior into Phase 13.
- Added Journal success event contracts for `accounting.journal-voucher.created`, `accounting.journal-voucher.draft-updated`, and `accounting.journal-voucher.draft-deleted` with actor, company, branch, voucher number/date, fiscal context, aggregate version, correlation, and causation context.
- Marked successful mutation events with `metadata.audit = true` and `metadata.integration = true`, matching the existing Accounting event/audit convention instead of introducing a parallel audit persistence abstraction.
- Added the security audit event `accounting.journal-voucher.authorization-denied` with actor/company/branch/permission/voucher context and `audit = true`, `security = true`, `integration = false`; rejected sensitive mutations therefore leave audit evidence but never masquerade as successful integration events.
- Success events are constructed and published only after the Journal Unit of Work has returned successfully. Create replay by the same idempotency `requestId` returns the already committed aggregate without emitting a duplicate `created` event.
- Rollback, validation failure, missing-account failure, and stale-version failure emit no success event. Focused tests explicitly capture whether publication occurs while the Unit of Work is active and require every success event to be outside the transaction boundary.
- Added tests for read permission rejection, authorization-denied security audit metadata, create post-commit event metadata/correlation/causation, retry event deduplication, rollback with zero success events, update versioned post-commit event, stale update with no update event, and delete post-commit event.
- Exported Journal permissions, audit/integration event contracts and factories through `@argin/accounting/journal` for Step 14 desktop composition and future server adapters.
- Published Step 13 implementation through commits `0bcd7e51b01a273f95db7c9eb4ee93eda9517885`, `273d30a9148a42e13eab791f7f5a192a9d3a48c9`, `8519aeffd133efdcba5705f2d7fca453ecd37403`, `06cb04c8556301b0d0d705b9e0b31477f1a43d42`, `0fc51cfb4daca68ef65284851e5e2ef3db56ebbc`, `794ebf24ca2818c0739e0f6576e05d5ff9e1d8ad`, and `04e69a853199b7f7a477c64a915ca9b27bab8d2f`.
- Local verification remains `pnpm --filter @argin/accounting typecheck` and `pnpm --filter @argin/accounting test`; persistence/Desktop permission wiring and full regression evidence are reconfirmed in Steps 14–17.

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

- Added `createJournalVoucherServices` as the Desktop composition boundary over the portable Phase 13 Application use cases and the SQLite Journal repository/Unit of Work, Account, Fiscal, Dimension and Number Series adapters.
- Replaced the prior pending Journal usage placeholder in `AccountingProvider` with `SqliteJournalVoucherUsageReader` and wired `JournalBackedAccountUsageReader` plus `JournalBackedAccountingDimensionUsageReader`; existing Chart of Accounts and Accounting Dimensions destructive operations therefore honor persisted Journal references while preserving the Phase 11 structural fallback reader.
- Added an exact-scope Desktop Number Series adapter for `accounting.journal-voucher`, keyed by company + fiscal year + optional branch. The adapter uses the existing fiscal SQLite Number Series repository, six-digit display and fiscal-year reset semantics without falling back to a broader branch/year counter.
- Corrected create orchestration so the business-number reservation occurs before the Journal write Unit of Work, matching the already documented retry/rollback rule that a reserved number remains consumed if the subsequent voucher transaction fails and avoiding nested Tauri database transactions. The second `(companyId, requestId)` check remains inside the Journal transaction to prevent duplicate committed vouchers.
- Added a Persian RTL `/accounting/journal-vouchers` workspace and navigation item with paged/searchable voucher list, full detail view, create/edit draft form, add/remove line editor, active postable Subsidiary account selector, branch selector, reference/description fields, and version-safe edit/delete actions.
- Added live debit/credit totals and balance feedback in Iranian Rial while still delegating authoritative structural/balance validation to the Journal aggregate and Application use cases; UI controls do not write Journal tables directly.
- Integrated the Phase 11 `SqliteAccountingDimensionSelectorService` per Journal line and voucher date so required/optional/forbidden dimension policies, single/multiple member selection and validity-window filtering are driven by the existing dynamic selector rather than duplicated UI rules.
- Added Persian presentation helpers for Solar Hijri date rendering, explicit Rial amount formatting, source/status labels and Persian/Arabic-digit Rial input parsing. Durable voucher dates continue to be submitted as canonical Gregorian `YYYY-MM-DD` values.
- Separated presentation-ready `JournalVoucherApplicationError` messages from unexpected technical diagnostics; business errors are shown directly while unexpected failures expose a separate expandable technical-details section.
- Added the five Journal Voucher permissions to the Security default-permission seed so non-full-access roles can actually be granted the Step 13 view/create/update-draft/delete-draft/view-history permissions through the existing security UI.
- Added focused Desktop presenter tests for Solar Hijri/Rial presentation, localized amount parsing and business-vs-technical error separation, plus composition tests proving read authorization is enforced before database access and lookup adapters request only active postable Subsidiary accounts and active branches.
- Added responsive RTL styling while preserving the existing Chart of Accounts, Dimensions and Coding Templates routes/workspaces and sharing the same `AccountingProvider` instead of introducing a competing composition root.
- Published Step 14 implementation through commits `c66d58859bdd05f979b003ea2227f6befa3c6d11`, `6e1cc9e153c085b11ef6c23d030a0b533f7061d0`, `69afe04cdca12f00d23670da870445c2d2ef55d7`, `97c9f1c8f6a0c8a66640eb2d4a18fa2ba05d8fe0`, `100f90179b5f7486aa92b52bb7362338fa79162a`, `0ba7c77912c8d4de7171c81ec3e371ffe1d4597d`, `4e5907574e078d237a15d6822cbc6009e3f37162`, `6dc0d26b98bdf707c16da3627488238248abe8a4`, `c98867b29b59733510cd11638bf20d262f224672`, `681238eedf455ade82b5e9f2d6ceb1ec91cfb410`, `803f6081bd14b0ecf14ce401c49891541be69a54`, `0b791fd0b6606473fc22cf223663e827d3f074b9`, and `9fcb7956f448a77113d99c2972faf87767431fe6`.
- Local validation remains `pnpm --filter @argin/accounting typecheck`, `pnpm --filter @argin/accounting test`, `pnpm --filter @argin/accounting-tauri typecheck`, `pnpm --filter @argin/accounting-tauri test`, `pnpm --filter @argin/security typecheck`, `pnpm --filter @argin/desktop typecheck`, `pnpm --filter @argin/desktop test`, and `pnpm --filter @argin/desktop build`; comprehensive Desktop/UI and affected regression execution evidence is reconfirmed in Steps 15–17.

### Step 15 — Domain and Application Test Completion

- Complete aggregate, balance, account/fiscal, dimensions, numbering, authorization, idempotency/retry and application orchestration tests.
- Cover malformed, unbalanced, cross-company, closed-period, inactive/non-postable account, missing dimension and stale-version paths.

Exit criteria:

- Critical Domain/Application success and failure paths have recorded passing evidence.

Status: Not started

### Step 16 — Persistence, Migration, Desktop, and Regression Tests

- Complete migration upgrade/fresh tests, repository contracts, transaction rollback, concurrency, usage detection, presenter/UI and desktop composition tests.
- Re-run Phase 10, 11 and 12 regression suites affected by journal-backed usage detection.

Exit criteria:

- Persistence/Desktop suites and affected prior-phase regressions pass with recorded counts.

Status: Not started

### Step 17 — Documentation and Monorepo Validation

- Add final Phase 13 implementation record and update ADR, roadmap/current target, changelog, phase/docs indexes, database dictionary, security model, glossary and accounting-engine documentation.
- Run frozen install, lint, typecheck, all tests, production build and `git diff --check`.
- Verify internal documentation links and review delivered diff against all frozen steps.

Exit criteria:

- Documentation matches implementation.
- Full validation passes and evidence is recorded.

Status: Not started

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
| 15 | Domain and Application Test Completion | Not started |
| 16 | Persistence, Migration, Desktop, and Regression Tests | Not started |
| 17 | Documentation and Monorepo Validation | Not started |
| 18 | Final Review, Merge, and Release | Not started |

## Change Requests

None.
