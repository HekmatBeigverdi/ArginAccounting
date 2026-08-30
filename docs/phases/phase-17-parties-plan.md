# Phase 17 — Parties — Fixed Implementation Plan

## Status

Phase 17 is active. Steps 1–16 are completed. Steps 17–20 are not started.

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
| 13 | Persian RTL Party Management UI | Completed |
| 14 | Party Selector and Future Module Consumption Contract | Completed |
| 15 | Shared Platform and Accounting Integration | Completed |
| 16 | Domain and Application Tests | Completed |
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

Status: Completed

Evidence:

- Added the independent `@argin/party` bounded-context package scaffold using the repository's strict TypeScript conventions.
- Added `packages/party/src/domain/party.ts` with a persistence-neutral Party aggregate model, stable string identity, explicit `companyId` scope, display `code`, initial `active` status, Gregorian created/updated timestamps, and frozen aggregate snapshots.
- Natural persons and legal entities are modeled as a discriminated union (`natural-person` / `legal-entity`) so type-specific names cannot be mixed accidentally.
- Natural-person display names are derived from normalized first/last names; legal-entity display names prefer normalized trade name and fall back to legal name.
- Added stable Domain error codes for required aggregate identity, company scope, display code, type-specific names, and creation timestamp validation.
- Added focused Domain tests covering classification guards, normalization, company scope, initial status, display-name semantics, frozen snapshots, required invariants, and invalid timestamps.
- Customer/Supplier roles, activation/deactivation transitions, identity/tax fields, contacts/addresses, persistence, and synchronization behavior remain intentionally deferred to their frozen later steps.

### Step 3 — Party Roles and Lifecycle

- Define reusable roles such as Customer, Supplier, and future-compatible additional roles.
- Allow one Party to hold multiple roles simultaneously.
- Define activation/deactivation and safe role add/remove semantics.
- Define duplicate/merge boundaries without implementing destructive merge unless explicitly required.

Exit: role and lifecycle rules prevent duplicated Customer/Supplier master records and invalid transitions.

Status: Completed

Evidence:

- Added explicit `customer` and `supplier` Party roles as reusable Domain classifications independent of natural/legal Party classification.
- Party creation accepts zero, one, or multiple roles; duplicate roles are normalized so one master Party can safely act as both Customer and Supplier.
- Added immutable `addPartyRole` and `removePartyRole` transitions. Repeated add of an existing role and repeated removal of an absent role are safe no-ops and do not create unnecessary aggregate revisions.
- Added immutable `activateParty` and `deactivateParty` lifecycle transitions with safe repeated-state no-ops.
- Mutation timestamps are validated and cannot move backwards relative to the aggregate's current `updatedAt`.
- Added `assessPartyMergeBoundary` to explicitly reject self-merge and cross-company merge while allowing only a same-company candidate assessment; no destructive merge implementation was introduced.
- Added focused tests covering role guards, multi-role Party semantics, duplicate role normalization, immutable add/remove operations, activation/deactivation, timestamp invariants, and merge boundaries.
- Identity/tax fields, duplicate-candidate detection heuristics, persistence, tombstone deletion semantics, and synchronization remain deferred to their fixed later steps.

### Step 4 — Identity, Registration, and Tax Information

- Model Iranian national ID, legal national identifier, registration number, economic/tax identifiers, and related metadata.
- Define normalization and validation rules with clear optionality by Party type.
- Avoid coupling to the later Iranian Taxpayer System submission model while preserving compatible master data.

Exit: identity/tax attributes and validations are deterministic and type-aware.

Status: Completed

Evidence:

- Added `party-identity.ts` as a persistence-neutral Domain value-object boundary for Iranian identity, registration, and tax master data.
- Natural-person identity supports national code, current economic number, and tax file number; legal-entity identity supports national identifier, registration number, current economic number, legacy 12-digit economic code, and tax file number.
- Persian and Arabic-Indic digits are normalized to Latin digits and common spaces/hyphens are removed before validation.
- Iranian natural-person national code validation includes exact 10-digit format, repeated-digit rejection, and modulo-11 checksum validation.
- Iranian legal-entity national identifier validation includes exact 11-digit format, repeated-digit rejection, and the legal-identifier checksum calculation.
- Current economic-number rules are type-aware: natural-person values are 14 digits and must begin with the national code when known; legal-entity values are 11 digits and must equal the national identifier when known. Legacy 12-digit economic codes are retained separately to prevent semantic mixing.
- Identity profiles are attached to the natural/legal Party discriminated union while remaining optional at Party creation; absent identity data is represented deterministically with null fields rather than undefined persistence semantics.
- Added stable identity error codes and focused tests for normalization, valid/invalid checksums, current/legacy economic numbers, registration/tax formats, mismatch detection, frozen identity snapshots, and aggregate integration.
- Contact/address modeling remains Step 5; duplicate detection, SQLite uniqueness/indexes, Taxpayer System submission DTOs, and synchronization behavior remain deferred to their fixed later steps.

### Step 5 — Contacts and Addresses

- Define phone, mobile, email, website, contact-person, and address value/child models.
- Support multiple addresses and contacts with explicit defaults/purposes where needed.
- Define Iranian postal/address fields without hard-coding UI formatting into Domain logic.

Exit: Party contact/address information is normalized, reusable, and persistence-neutral.

Status: Completed

Evidence:

- Added persistence-neutral `party-contact.ts` and `party-address.ts` Domain child/value models and exported them from `@argin/party`.
- Contact types include phone, mobile, email, and website; purposes include general, sales, purchasing, accounting, management, and other, with optional contact-person and title metadata.
- Phone/mobile values normalize Persian and Arabic-Indic digits, whitespace, parentheses, and hyphens; emails normalize case; website values normalize an omitted scheme to HTTPS and validate host shape.
- Party addresses support registered, billing, shipping, operational, postal, and other purposes plus province, city, district, free address line, Iranian 10-digit postal code, and explicit primary semantics.
- Persian/Arabic postal digits and common separators normalize deterministically without embedding UI presentation rules in Domain logic.
- Contacts and addresses are attached to the Party aggregate as frozen collections. Duplicate child IDs are rejected.
- At most one primary contact is permitted per contact `type + purpose`, and at most one primary address is permitted per address purpose; multiple contacts/addresses across different purposes remain supported.
- Added focused tests for contact normalization/validation, contact-person metadata, address/postal normalization, multiple children, frozen aggregate collections, duplicate child IDs, and primary-address invariants.
- Updated the Step 2 aggregate regression snapshot for deterministic empty contact/address collections so the expanded aggregate does not silently break earlier Domain coverage.
- Repository persistence, CRUD mutation services, SQLite constraints, and UI formatting remain deferred to their fixed later steps.

### Step 6 — Application and Repository Contracts

- Define Commands, Queries, DTOs, readers/repositories, paging, sorting, filtering, lookup, and selector contracts.
- Define Unit of Work and stable Application errors.
- Keep contracts compatible with future SQLite, PostgreSQL, HTTP, and bridge adapters.

Exit: Party capabilities are consumable without React, Tauri, SQLite, or HTTP dependencies.

Status: Completed

Evidence:

- Added persistence-neutral command contracts for natural/legal create/update operations, status changes, and role add/remove operations with explicit company/actor/correlation/request context.
- Added company-scoped query contracts for detail lookup, paged list/search/filter/sort, and bounded selector lookup; no `findAll()` contract was introduced.
- Added summary/detail/selector DTO contracts and a generic page result so presentation/API adapters are not forced to consume the Domain aggregate directly.
- Split query reads (`PartyReader`) from aggregate writes (`PartyRepository`) to preserve CQRS-friendly adapter boundaries and efficient future SQLite/PostgreSQL query implementations.
- Added a `PartyUnitOfWork` contract matching the repository's existing transaction pattern while remaining storage-neutral.
- Added stable `PartyApplicationError` codes for not-found, code/identity conflicts, concurrency, permission denial, and invalid-query boundaries.
- Mutation command contracts expose optional expected-version fields so optimistic concurrency can be enforced by later Application/SQLite implementations without changing the public command shape.
- Added focused contract tests proving company-scoped paging shape, stable Application errors, and adapter-neutral Reader/Repository/Unit-of-Work assignability.
- No Application service implementation, duplicate-detection algorithm, authorization enforcement, SQLite adapter, Tauri/React code, HTTP transport, or bridge implementation was added in this step.

### Step 7 — Application Services and Duplicate Detection

- Implement create/update/activate/deactivate and role-management use cases.
- Implement duplicate-candidate detection using normalized identifiers and justified business fields.
- Distinguish hard uniqueness violations from advisory duplicate matches.
- Preserve idempotent integration boundaries where requests may be retried later.

Exit: Party Application behavior is deterministic, authorization-ready, and duplicate-safe.

Status: Completed

Evidence:

- Added `PartyApplicationService` for create, profile update, activate/deactivate, and role add/remove use cases using the persistence-neutral `PartyUnitOfWork`/`PartyRepository` contracts.
- Added `PartyDuplicateLookup`, probe, candidate, severity, reason, and assessment contracts so duplicate detection can be implemented efficiently by SQLite in Step 9 and by future PostgreSQL/Bridge adapters without changing Application behavior.
- Hard duplicate conflicts are limited to strong company-scoped identifiers: Party code and official identity/economic identifiers. Hard conflicts block mutation with stable Application error codes.
- Display-name similarity is modeled as advisory duplicate evidence only; advisory matches are returned to callers and never silently block creation/update.
- Update duplicate probes exclude the current Party id to prevent self-matching, and `expectedVersion` flows unchanged to the repository so Step 9 can enforce optimistic concurrency.
- Added `updatePartyProfile` Domain behavior that preserves durable Party id, company scope, display code, roles, status, and creation timestamp while revalidating type-specific identity/contact/address data. Natural/legal classification changes through ordinary update are explicitly rejected.
- Create retries using the same durable Party id are idempotent only when the normalized semantic payload matches the existing Party. A different payload using the same durable id returns `party.id.conflict` instead of overwriting data.
- Repeated status/role operations reuse Domain no-op semantics and avoid redundant repository writes.
- Added focused in-memory Application tests covering advisory duplicate acceptance, hard identity rejection, safe durable-id replay, conflicting replay rejection, self-excluding update duplicate probes, expected-version forwarding, classification immutability, and no-op write suppression.
- SQLite uniqueness/index enforcement, concrete duplicate queries, authorization enforcement, audit emission, and cross-process idempotency storage remain assigned to their fixed later steps.

### Step 8 — Migration, Schema, and Indexing

- Add versioned SQLite migrations for Party, roles, contacts, addresses, and required metadata.
- Add unique constraints and search indexes only where supported by domain rules and expected query shapes.
- Preserve stable ID/concurrency/tombstone-compatible fields needed for future synchronization.

Exit: schema and migrations faithfully represent the accepted model and can be upgraded deterministically.

Status: Completed

Evidence:

- Added `apps/desktop/src-tauri/migrations/0016_parties.sql` using the repository's existing numbered Tauri SQLite migration convention.
- Added `parties`, `party_roles`, `party_contacts`, and `party_addresses` tables with stable TEXT identifiers, company-scoped ownership, Domain-aligned classification/status/role/contact/address checks, Iranian identity/tax field shape, Gregorian created/updated metadata, and `version >= 1` optimistic-concurrency storage.
- Enforced company-scoped hard duplicate boundaries for Party code, national code, legal national identifier, and economic number while leaving display-name similarity advisory as defined by Step 7.
- Added same-company composite foreign keys for Party child records and cascade deletion of child rows without introducing a Party deletion/tombstone business operation before Step 10.
- Added partial unique indexes matching Domain primary-contact (`type + purpose`) and primary-address (`purpose`) invariants.
- Added bounded reader/selector/duplicate-query indexes for company/status/name, classification/name, updated ordering, roles, contact lookup, and postal lookup.
- Registered migration version 16 in the desktop Tauri migration registry.
- Also registered the pre-existing Phase 16 `0015_accounting_report_indexes.sql`, which existed on disk but was missing from `database_migrations()`; this restores deterministic sequential registration without changing report behavior.
- SQLite repository implementation, transaction orchestration, query adapters, optimistic update statements, and error mapping remain assigned to Step 9. Full tombstone/source/external-reference semantics remain assigned to Step 10.

### Step 9 — SQLite Repository and Atomic Transactions

- Implement SQLite repository/read adapters and Unit of Work integration.
- Guarantee atomic multi-table Party writes.
- Enforce optimistic concurrency and deterministic error mapping.
- Avoid N+1 behavior and unbounded in-memory loading.

Exit: SQLite persistence matches Application semantics with focused repository tests.

Status: Completed

Evidence:

- Added the dedicated `@argin/party-tauri` SQLite adapter package, preserving the established bounded-context / `*-tauri` separation used by Company, Accounting, Fiscal, Security, Audit, and Platform infrastructure.
- Added `SqlitePartyRepository` persistence for Party parent rows plus role/contact/address child tables. Aggregate reads remain company-scoped and hydrate one aggregate with bounded child queries rather than exposing an unbounded `findAll()` path.
- Added `SqlitePartyUnitOfWork` directly on the shared `DatabaseExecutor.transaction()` contract. Party parent/role/contact/address writes therefore share one transaction session and roll back together when the Application service fails.
- Added optimistic `UPDATE ... WHERE company_id = ? AND id = ? AND version = ?` behavior when `expectedVersion` is supplied, increments `version` on every successful mutation, and distinguishes missing Party from stale-version conflict using stable `party.notFound` / `party.concurrentModification` errors.
- Child rows are replaced only after the optimistic parent update succeeds, preventing stale writers from deleting or replacing current child data.
- Added SQLite constraint error mapping for durable-id, company-scoped Party code, and official identity uniqueness so race conditions between Application duplicate-check and database write return stable `party.id.conflict`, `party.code.conflict`, or `party.identity.conflict` errors instead of leaking raw SQLite errors.
- Added `SqlitePartyReader` with company-scoped detail reads, SQL-level paging/filtering/sorting, bounded selector limits, role filtering via `EXISTS`, and summary projections that avoid loading all Party aggregates into memory.
- Added `SqlitePartyDuplicateLookup` using indexed company/code/national-code/national-id/economic-number predicates for hard conflicts and bounded same-classification display-name lookup for advisory duplicate candidates.
- Added focused adapter tests covering atomic Unit of Work usage, multi-table insert participation, stale-version detection before child replacement, missing-vs-concurrent error mapping, SQL-level page limits/offsets, role filtering, and selector bound enforcement.
- Authorization/audit enforcement remains Step 11; Argin Bridge/tombstone/source/external-reference semantics remain Step 10; broader real-SQLite migration/repository regression coverage remains Step 17.

### Step 10 — Argin Bridge and Future Synchronization Contract

- Formalize stable cross-database Party identity and display-number separation.
- Formalize version/change metadata, tombstone-compatible deletion lifecycle, source/external references, and retry/idempotency boundaries.
- Define persistence-neutral sync-facing DTO/boundary contracts only where necessary to protect future compatibility.
- Explicitly document what remains deferred to Phase 45.

Exit: future Argin Bridge/PostgreSQL synchronization can be added without redesigning Party identity or breaking current SQLite/Desktop behavior.

Status: Completed

Evidence:

- Added the persistence-neutral `party-sync.ts` contract with explicit `PartySyncChangeEnvelope` upsert/tombstone variants, durable `(companyId, partyId)` identity, separate display code, integer version, change timestamp, operation id, idempotency key, and external references.
- Added stable sync contract errors and constructors that reject invalid versions/timestamps, mismatched snapshots, empty operation/idempotency identifiers, and duplicate external references before any transport adapter exists.
- Kept Party lifecycle `active`/`inactive` distinct from synchronization deletion. A tombstone carries `deletedAt` and a null business snapshot instead of overloading ordinary inactive status.
- Added migration `0017_party_sync_metadata.sql` with nullable `parties.deleted_at`, company-scoped `party_external_references`, uniqueness constraints for source-system identities, and indexes for incremental version/change scans and tombstone/external-reference lookup.
- Registered migration version 17 in the desktop migration registry without rewriting migration 0016.
- Added `docs/architecture/party-argin-bridge-contract.md` documenting durable-id/display-code separation, version ordering, tombstone semantics, external references, retry/idempotency requirements, and the exact boundary deferred to Phase 45.
- Added focused tests proving durable identity cannot drift from the snapshot, display code remains separate, tombstones contain no business snapshot, versions are positive integers, and duplicate external references are deterministic errors.
- No network endpoint, HTTP client/server, background sync worker, checkpoint/cursor, conflict-resolution engine/UI, PostgreSQL adapter, or durable network idempotency processor was introduced. Those remain explicitly deferred to Phase 45.

### Step 11 — Permissions, Audit, and Approval Integration

- Add granular Party view/create/update/status/import/export permissions.
- Enforce company scope and permissions at the Application boundary.
- Emit audit events with actor/correlation/context for sensitive mutations.
- Integrate Approval only for operations justified by existing approval architecture; do not invent unnecessary approval workflows.

Exit: security and audit behavior do not depend on UI visibility and do not leak cross-scope Party data.

Status: Completed

Evidence:

- Added seven granular `master-data.parties.*` permissions for view, create, update, status changes, role management, import, and export and registered them in the shared Security permission catalog.
- Added `SecuredPartyApplicationService` and `SecuredPartyReader`; authorization is evaluated at the Application boundary before reads or mutations and receives explicit actor/company/correlation/request context.
- Added persistence-neutral Party audit contracts and correlation-aware events for create, update, status, role, import, and export operations. Successful mutations emit audit data through an injected `PartyAuditSink` without embedding audit persistence in Domain/SQLite code.
- Idempotent create replay does not emit a duplicate mutation audit event.
- Normalized optional command `requestId` to nullable Security/Audit metadata so the strict `exactOptionalPropertyTypes` configuration remains compatible with existing command contracts.
- Reviewed the existing Approval architecture. Routine Party master-data CRUD/status/role/import/export does not justify a dedicated approval lifecycle, so no artificial Party approval workflow was introduced.
- Added focused tests proving authorization runs before writes and successful mutations emit correlated audit metadata.
- Concrete composition of `PartyAuditSink` with the shared Audit infrastructure remains an adapter/composition concern and can be wired during Step 15 without changing the Step 11 public contracts.

### Step 12 — Bulk Import and Export

- Support professional Excel/CSV import with preview, column mapping where justified, normalization, validation, and duplicate reporting.
- Support atomic import mode so invalid batches cannot leave partial master data.
- Provide export without moving business logic into spreadsheet adapters.

Exit: large Party master sets can be transferred safely and diagnostically.

Status: Completed

Evidence:

- Added `PartyBulkTransferService` with explicit column mapping, Persian/English classification and role normalization, Domain-driven Party/contact/address validation, database duplicate assessment, and duplicate detection inside the imported batch.
- Preview reports row numbers, validation issues, hard duplicate Party IDs, and advisory duplicate Party IDs before persistence.
- Atomic mode rejects invalid batches without opening a write transaction and writes a valid batch through one `PartyUnitOfWork`; non-atomic mode isolates rows and returns per-row write failures.
- Imported Contact/Address child IDs are scoped by the durable Party ID before persistence so independent imported Parties cannot collide on global SQLite child primary keys.
- Added `legacyEconomicCode` to legal-entity import/export mapping so scalar Iranian identity data is not silently lost in a master-data round trip.
- Added `PartyMasterExportService` and `SqlitePartyMasterExportReader` for company-scoped, bounded page streaming of Party identity/registration, roles, and primary contact/address fields without loading the complete master set into memory.
- Added CSV/XLSX codecs in `@argin/party-tauri`; file adapters enforce file/row/column limits and only convert tabular data while Party business validation remains in Domain/Application.
- Added summary and richer Master Data CSV/XLSX exports using canonical column names compatible with the import mapping.
- Import/export operations reuse the permission and audit contracts established in Step 11 through dependency injection; no UI-only security was introduced.
- Added focused tests for in-file duplicate preview, zero-write invalid atomic batches, one-transaction valid atomic batches, unique imported child IDs, bounded export paging, and CSV/XLSX round trips.
- Party management screens, column-mapping UX, and preview UI remain Step 13; broader real-SQLite/import/Desktop regression coverage remains Step 17.

### Step 13 — Persian RTL Party Management UI

- Build list/search/filter/detail/create/edit Party surfaces using the Phase 14 design system.
- Use compact desktop-friendly tables and forms.
- Provide loading, empty, error, keyboard, focus, accessibility, responsive, and display-density behavior.
- Present Persian labels and appropriate Solar Hijri dates while keeping durable timestamps Gregorian internally.

Exit: Party management is usable as a professional Persian desktop Master Data workspace.

Status: Completed

Evidence:

- Added the `/master-data/parties` desktop route and a permission-aware `اشخاص` navigation entry under `اطلاعات پایه`.
- Added a Persian RTL Party workspace with bounded 40-row paging, deferred search, natural/legal classification filtering, status filtering, role filtering, compact Phase 14 density tokens, and a split list/detail layout that avoids unbounded Party loading.
- Added natural-person and legal-entity create/edit forms covering accepted identity/tax fields, primary phone/mobile/email/website, registered address/postal code, and deterministic Domain/Application validation rather than duplicating business rules in React.
- Added explicit active/inactive actions and independent Customer/Supplier role-management actions through `SecuredPartyApplicationService`; UI visibility is not the security boundary.
- Tightened secured create behavior so assigning roles during Party creation also requires `master-data.parties.manage-roles`, with focused regression coverage proving denial occurs before persistence.
- Added Solar Hijri display of created/updated timestamps through `Intl.DateTimeFormat("fa-IR-u-ca-persian")` while durable stored timestamps remain Gregorian ISO values.
- Added loading, empty, success/error feedback, keyboard row selection, focus-visible styling, Escape-to-close create/edit behavior, responsive breakpoints, and display-density-aware controls/row heights using the canonical Phase 14 design tokens.
- Added the Step 12-deferred CSV/XLSX import UX: file selection, Persian/English automatic column matching, manual column mapping, whole-file Domain/Application validation, hard/advisory/batch-duplicate diagnostics, bounded preview rendering, and atomic-import execution that refuses partial writes when invalid rows exist.
- Added explicit desktop workspace dependencies on `@argin/party` and `@argin/party-tauri`; no Party Domain rules were moved into React or spreadsheet adapters.
- Concrete persistence of Party audit events through the shared Audit composition remains the explicitly deferred Step 15 adapter/composition task established in Step 11; Step 13 keeps the secured Party contracts intact without introducing a second audit implementation.
- Reusable Party selector UI/contracts remain Step 14. No Sales, Purchases, Treasury, balances, posting, network synchronization, or Phase 45 behavior was introduced.

### Step 14 — Party Selector and Future Module Consumption Contract

- Provide reusable Party lookup/selector UI and Application contracts.
- Support filtering by role/status/company without coupling to Sales, Purchases, Treasury, or Inventory implementations.
- Return stable identifiers and display metadata needed by future documents.

Exit: later operational modules can consume Party selection without cloning Party logic or UI.

Status: Completed

Evidence:

- Added persistence-neutral `party-selection.ts` on top of the existing Step 6 `PartyReader.select`/`PartySelectorDto` contracts rather than introducing a second lookup abstraction.
- Added `PartySelectionPolicy` for company-scoped bounded lookup with reusable role/status constraints and a safe 20-row active-only default; callers may explicitly widen status scope and configure limits up to the existing 100-row selector ceiling.
- Added `PartySelectionReference` containing durable `partyId` plus display code, display name, classification, and commercial roles so future documents can store stable identity while rendering useful lookup metadata without importing the Party aggregate.
- Added deterministic `PartySelectionContractError` codes for missing company scope and unsafe selector limits, plus eligibility/reference helpers shared by non-React consumers.
- Added focused Application tests covering active defaults, role/status filtering policy, deduplication of requested filters, company/limit guards, stable selection references, and eligibility behavior.
- Added reusable Persian RTL `PartySelector` desktop component under `components/party`; it consumes only an injected `PartyReader.select` boundary and therefore has no SQLite/Tauri dependency and can be fed a `SecuredPartyReader` by future modules.
- Added accessible combobox/listbox semantics, deferred bounded search, loading/empty states, keyboard Arrow/Enter/Escape navigation, clear behavior, blur close, active-option tracking, natural/legal and commercial-role display metadata, and Phase 14 density/design-token styling.
- The selector component does not embed Customer/Supplier business behavior: future Sales/Purchases/Treasury consumers express their requirements through generic role/status policy (`customer`, `supplier`, active/inactive) without reverse coupling Party to those modules.
- No Sales, Purchase, Treasury, Inventory document models, balances, posting rules, or module-specific workflows were introduced in Step 14.

### Step 15 — Shared Platform and Accounting Integration

- Integrate Company scope, shared query infrastructure, metadata, notifications/events, concurrency, and existing platform contracts where appropriate.
- Confirm no accounting balances/posting logic are incorrectly introduced into Party Master Data.
- Confirm future dimension/account/document references can use stable Party identity without reverse coupling.

Exit: Party fits the existing architecture cleanly without violating bounded responsibilities.

Status: Completed

Evidence:

- Replaced the Step 11/13 no-op desktop Party audit composition with `createPersistentPartyAuditSink`, mapping persistence-neutral `PartyAuditEvent` values into the canonical `@argin/audit` model and storing them through `@argin/audit-tauri` on the shared desktop database.
- Wired the persistent Audit sink into both ordinary Party mutations (`create`, `update`, status and role changes) and bulk import execution. The mapping preserves the real actor id, company scope, Party target id, correlation id, request id, occurrence timestamp, Party action, and operation metadata.
- Mapped Party actions to canonical shared Audit actions: create/update/status-change/assign/unassign/import/export. Audit recording is treated as an internal consequence of an already-authorized Party command, so users do not require a separate UI-facing Audit-record permission merely to have their successful operation audited.
- Added a deterministic `toSharedAuditEntryInput` mapper plus focused Desktop tests covering action mapping, actor/company scope, durable Party target identity, correlation id, request id, and metadata preservation.
- Confirmed Party already aligns with shared platform metadata and concurrency conventions: company scope is explicit on commands/queries, correlation/request ids flow through Application/Audit boundaries, durable timestamps remain Gregorian, bounded list/selector contracts avoid unbounded reads, and `expectedVersion`/SQLite `version` remain the optimistic-concurrency boundary.
- Deliberately did not add a second Party notification/domain-event stream because no current Phase 17 consumer requires it. Future operational workflows may use the existing shared Platform event bus when a concrete consumer exists rather than introducing speculative events now.
- Added `docs/architecture/party-shared-platform-integration.md` documenting shared-platform alignment, Audit composition, future module dependency direction, and explicit accounting exclusions.
- Added architecture regression coverage proving `@argin/party` has no dependency on Accounting, Audit, Tauri database adapters, or other infrastructure packages; Audit persistence stays in Desktop composition.
- Confirmed future documents reference Parties through stable `PartySelectionReference.partyId`; display `code`/`displayName` remain presentation metadata and must not replace durable identity.
- No Party balances, opening balances, journal lines, posting rules, account/dimension ownership, automatic vouchers, sales/purchase documents, treasury behavior, or reverse dependency from Party to Accounting was introduced.

### Step 16 — Domain and Application Tests

- Cover aggregate invariants, Party types, roles, lifecycle, identity validation, contacts/addresses, duplicate detection, Application errors, idempotent boundaries, authorization behavior, and optimistic concurrency contracts.

Exit: core Party semantics are comprehensively validated independent of SQLite/Desktop.

Status: Completed

Evidence:

- Reviewed the existing Party Domain/Application suite across aggregate/classification, role/lifecycle, Iranian identity, contact/address, contracts, Application service, security boundary, bulk transfer, selector, synchronization, and architecture-boundary tests and added only missing semantic coverage instead of duplicating prior cases.
- Added focused Step 16 coverage proving company-scoped Party code conflicts are emitted before duplicate lookup, preserving the stable `party.code.conflict` boundary and avoiding unnecessary duplicate queries.
- Added mutation-boundary coverage proving missing Party records deterministically return `party.notFound` for status changes and role add/remove use cases.
- Added optimistic-concurrency contract coverage proving `expectedVersion` is forwarded unchanged for status, add-role, and remove-role mutations that actually change aggregate state.
- Added duplicate-assessment coverage proving hard and advisory evidence remain independently preserved and that update-style assessments carry `excludePartyId` to prevent self-matching.
- Added secured-reader coverage proving `master-data.parties.view` authorization is checked with the queried company scope and actor/correlation/request context before the underlying reader is invoked.
- Existing tests continue to cover natural/legal aggregate invariants, role/lifecycle no-ops, timestamp monotonicity, Iranian identifier normalization/checksums, contacts/addresses and primary invariants, durable-id idempotent create replay, conflicting replay rejection, classification immutability, hard/advisory duplicate semantics, authorization-before-write, role-management authorization, and correlated audit emission.
- No SQLite, migration, Tauri, browser interaction, or real persistence test was added in Step 16; those remain explicitly assigned to Step 17.

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

Focused validation commands for the implemented Domain boundary:

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
```

The implementation is intentionally persistence-neutral and does not require SQLite, Tauri, Desktop, or network integration validation in Step 2. Full repository validation remains mandatory in Step 18.

## Step 3 Validation

Focused validation commands for Party roles and lifecycle:

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
```

Step 3 remains Domain-only and intentionally introduces no SQLite, Tauri, React, network, tax-identity, or synchronization dependencies. Full monorepo validation remains mandatory in Step 18.

## Step 4 Validation

Focused validation commands for Iranian identity, registration, and tax master data:

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
```

Step 4 remains Domain-only. It does not add persistence uniqueness constraints, Taxpayer System submission contracts, contacts/addresses, or synchronization behavior; those remain assigned to later fixed steps.

## Step 5 Validation

Focused validation commands for Party contact/address models and aggregate integration:

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
```

Step 5 remains Domain-only. It introduces no SQLite persistence, Application CRUD services, React/Tauri UI, or synchronization implementation; those remain assigned to later fixed steps.

## Step 6 Validation

Focused validation commands for Application and Repository contracts:

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
```

Step 6 defines interfaces/types and focused contract tests only. SQLite/PostgreSQL repositories, Application services, duplicate detection, authorization, transport adapters, and UI implementation remain assigned to later fixed steps.

## Step 7 Validation

Focused validation commands for Application services and duplicate detection:

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
```

Step 7 uses in-memory test adapters only. Concrete SQLite persistence, database uniqueness/index enforcement, authorization/audit integration, React/Tauri UI, Argin Bridge transport, and Phase 45 synchronization remain assigned to their fixed later steps.

## Step 8 Validation

Focused validation commands for the Party package plus desktop migration registry:

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/desktop typecheck
cd apps/desktop/src-tauri && cargo check
```

Step 8 adds schema/constraints/indexes and migration registration only. SQLite repository/read adapters, atomic transaction implementation, optimistic UPDATE statements, and database error mapping remain assigned to Step 9. Repository/migration behavior tests remain mandatory in Step 17.

## Step 9 Validation

Focused validation commands for the SQLite Party adapter and its Application contracts:

```bash
pnpm install
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/party-tauri typecheck
pnpm --filter @argin/party-tauri test
```

`pnpm install` is included because Step 9 introduces the new workspace package `@argin/party-tauri`; it refreshes the workspace links and lockfile importer locally. Step 9 focused tests use a deterministic database test double to validate transaction participation, concurrency/error behavior, and bounded query construction. Full real-SQLite migration/repository/rollback coverage remains mandatory in Step 17, and full monorepo validation remains mandatory in Step 18.

## Step 10 Validation

Focused validation commands for the future synchronization contract and migration registry:

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/desktop typecheck
cd apps/desktop/src-tauri && cargo check
```

Step 10 validates only the persistence-neutral bridge envelope semantics plus versioned SQLite metadata storage. It intentionally does not require or introduce a network server/client, PostgreSQL adapter, background sync worker, conflict-resolution UI, checkpoint processor, or Phase 45 synchronization engine.

## Step 11 Validation

Focused validation commands for the Party security/audit boundary and shared permission catalog:

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/security typecheck
pnpm --filter @argin/security test
```

Step 11 keeps authorization and audit contracts persistence-neutral. It does not add UI-only security, a Party-specific approval lifecycle, Bulk Import/Export behavior, or new SQLite schema. Concrete shared Audit composition remains part of later integration wiring and does not alter the accepted Party Application contracts.

## Step 12 Validation

Focused validation commands for Party bulk transfer and file adapters:

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/party-tauri typecheck
pnpm --filter @argin/party-tauri test
```

Step 12 reuses the monorepo's existing pinned `xlsx@0.18.5` dependency for the Party file adapter and keeps spreadsheet parsing/serialization outside Domain/Application business rules. Mapping UX and import-preview screens remain Step 13; full real-SQLite/import/Desktop regression coverage remains Step 17.

## Step 13 Validation

Focused validation commands for the Party desktop workspace, import UI, and security regression:

```bash
pnpm install
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/party-tauri typecheck
pnpm --filter @argin/party-tauri test
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop test
pnpm --filter @argin/desktop build
```

`pnpm install` is intentionally included because Step 13 adds direct desktop workspace links to `@argin/party` and `@argin/party-tauri`; pnpm must refresh the desktop lockfile importer before frozen-install validation. Full browser/Desktop interaction regression, real-SQLite import coverage, performance/accessibility validation, and complete monorepo validation remain assigned to Steps 17–18. Reusable Party selector behavior remains Step 14 and concrete shared Audit persistence composition remains Step 15.

## Step 14 Validation

Focused validation commands for the reusable Party selection contract and desktop selector component:

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop build
```

Step 14 adds no new persistence schema or module-specific document behavior. The Application contract remains storage-neutral and the React component consumes only the injected `PartyReader.select` boundary; broader selector integration against real SQLite/Desktop interaction remains part of Step 17 and accessibility/performance validation remains Step 18.

## Step 15 Validation

Focused validation commands for shared Audit composition and architecture boundaries:

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/audit typecheck
pnpm --filter @argin/audit-tauri typecheck
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop test
pnpm --filter @argin/desktop build
```

Step 15 adds no Party persistence schema and no accounting/posting behavior. The Desktop tests validate deterministic Party-to-shared-Audit mapping while `@argin/party` tests protect the bounded-context dependency direction. Real SQLite Audit persistence interaction remains part of the broader infrastructure/Desktop regression work in Step 17, and complete monorepo/performance/accessibility validation remains Step 18.

## Step 16 Validation

Focused validation commands for the complete Domain/Application Party test matrix:

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
```

Step 16 remains independent of SQLite/Tauri/Desktop behavior. It expands semantic coverage around stable Application errors, company-scoped authorization, duplicate assessment, mutation idempotency boundaries, and optimistic-concurrency forwarding. Real repository/migration/import/Desktop behavior remains Step 17, and complete monorepo/performance/accessibility validation remains Step 18.
