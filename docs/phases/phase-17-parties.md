# Phase 17 — Parties

## Purpose

Phase 17 introduces Parties as canonical Master Data for natural persons and legal entities. Customer and Supplier are roles on one Party record, not separate duplicated masters.

## Delivered Architecture

- Persistence-neutral `@argin/party` Domain/Application package.
- SQLite adapter package `@argin/party-tauri`.
- Durable Party identity separated from display code.
- Company-scoped natural/legal classification, lifecycle, Customer/Supplier roles, Iranian identity/tax data, contacts, and addresses.
- Application CRUD, duplicate assessment, optimistic concurrency, authorization, audit contracts, bulk import/export, and reusable selection contracts.
- Persian RTL Desktop Party workspace and reusable Party selector.
- Argin Bridge/future synchronization compatibility through version, tombstone, external-reference, operation/idempotency, and stable identity contracts without implementing network synchronization.

## Domain Rules

- One Party may be both Customer and Supplier.
- Natural-person and legal-entity fields are modeled as a discriminated union.
- Party code is human-readable/display identity; `partyId` is the durable cross-store identity.
- Ordinary update cannot change classification.
- Active/inactive lifecycle is separate from synchronization deletion/tombstone semantics.
- Iranian national code, legal national identifier, registration/economic/tax identifiers are normalized and validated in Domain.
- Multiple contacts and addresses are supported with explicit primary invariants.

## Application and Persistence

- Reads are company-scoped and bounded; no unbounded `findAll()` contract exists.
- Writes use `PartyUnitOfWork` and optimistic `expectedVersion` semantics.
- SQLite persistence uses migrations `0016_parties.sql` and `0017_party_sync_metadata.sql`.
- Hard duplicates are protected by company-scoped code/official-identity uniqueness; display-name similarity remains advisory.
- Bulk import supports CSV/XLSX preview, mapping, Domain validation, duplicate diagnostics, and atomic mode.
- Export streams bounded pages and excludes tombstones.

## Security and Audit

Permissions:

- `master-data.parties.view`
- `master-data.parties.create`
- `master-data.parties.update`
- `master-data.parties.change-status`
- `master-data.parties.manage-roles`
- `master-data.parties.import`
- `master-data.parties.export`

Authorization is enforced in the Application boundary through `SecuredPartyApplicationService` and `SecuredPartyReader`. UI visibility is not the security boundary. Successful Party mutations are mapped into the shared append-only Audit infrastructure with actor, company, target Party, correlation/request identifiers, occurrence time, action, and metadata.

Routine Party CRUD/status/role/import/export does not introduce a dedicated Approval workflow because the existing approval architecture does not justify one for these Master Data operations.

## Desktop Experience

The `/master-data/parties` workspace provides Persian RTL list/search/filter/detail/create/edit behavior with compact Phase 14 density, Solar Hijri presentation, keyboard selection, loading/empty/error states, localized Party errors, modal feedback, CSV/XLSX import preview, and permission-aware actions.

`PartySelector` provides an accessible bounded combobox/listbox contract for future Sales, Purchases, Treasury, and other operational modules. Consumers receive stable `partyId` plus display metadata and may constrain role/status without depending on SQLite or Party UI implementation.

## Future Integration Boundary

Future documents must persist Party references by durable `partyId`; code/name are display metadata only. Party does not own balances, opening balances, journals, posting rules, sales/purchase documents, treasury operations, inventory ownership, or automatic accounting entries.

Target future path remains:

`Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`

Full synchronization remains Phase 45.

## Validation

Focused Domain/Application, SQLite/repository, migration, import/export, Desktop regression, accessibility/RTL/density, and representative SQLite query-plan tests were added during Steps 16–18.

Repository-owner validation for Step 18 was confirmed green after running the Phase 17 validation path. The validator covers a representative 50,000-Party SQLite dataset and checks bounded list/selector/duplicate index usage without a hardware-specific latency threshold.

## Key Documents

- `docs/phases/phase-17-parties-plan.md`
- `docs/phases/phase-17-step-18-validation-evidence.md`
- `docs/architecture/party-argin-bridge-contract.md`
- `docs/architecture/party-shared-platform-integration.md`
- `docs/adr/ADR-0017-party-master-data-model.md`
