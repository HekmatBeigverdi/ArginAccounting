# Phase 17 — Parties — Release Notes

## Version

`v0.17.0`

## Summary

Phase 17 introduces the canonical Party Master Data bounded context for ArginAccounting. A Party is a company-scoped natural person or legal entity with stable durable identity and may simultaneously hold Customer and Supplier roles without duplicate master records.

## Added

- Persistence-neutral `@argin/party` Domain/Application package with natural-person and legal-entity classification.
- Customer/Supplier role model with multi-role support and explicit active/inactive lifecycle.
- Iranian identity, registration, tax, contact, address, and postal-data normalization/validation.
- Duplicate assessment with hard identifier conflicts and advisory duplicate candidates.
- Durable request/idempotency and optimistic-concurrency boundaries.
- SQLite Party repository, readers, duplicate lookup, Unit of Work, and deterministic error mapping in `@argin/party-tauri`.
- Migrations `0016_parties.sql` and `0017_party_sync_metadata.sql`.
- Argin Bridge/future synchronization contracts with stable identity, version/change metadata, tombstones, idempotency keys, and external references while leaving active synchronization to Phase 45.
- Granular Party permissions and Application-boundary authorization.
- Persistent Party Audit integration through the shared Audit infrastructure.
- CSV/XLSX import with mapping, preview, Domain validation, duplicate diagnostics, and atomic mode.
- Bounded CSV/XLSX master-data export.
- Persian RTL Party management workspace with compact Phase 14 density, Solar Hijri presentation, filters, paging, create/edit, status and role actions, translated errors, Toast feedback, and import workflow.
- Reusable Party Selector contract/component for future Sales, Purchases, Treasury, and other modules.

## Database

- Added `parties`, `party_roles`, `party_contacts`, `party_addresses`, and `party_external_references`.
- Added company-scoped code/identity uniqueness, same-company child foreign keys, primary contact/address constraints, optimistic `version`, `deleted_at`, synchronization indexes, and external-reference uniqueness.
- Query paths remain bounded and indexed for list, selector, duplicate detection, export, and future change tracking.

## Security and Audit

Added permissions:

- `master-data.parties.view`
- `master-data.parties.create`
- `master-data.parties.update`
- `master-data.parties.change-status`
- `master-data.parties.manage-roles`
- `master-data.parties.import`
- `master-data.parties.export`

Authorization is enforced at the Application boundary. Successful create/update/status/role/import/export operations produce correlated Party audit evidence through the shared Audit store. No artificial Party approval lifecycle was introduced.

## Validation

Repository-owner validation confirmed the Phase 17 focused and unified gates, including:

- Domain/Application tests.
- SQLite repository, migration, rollback, concurrency, import/export, and selector tests.
- Desktop regression tests.
- Persian RTL, keyboard, accessibility, density, and bounded-loading quality contracts.
- Representative 50,000-row SQLite query-plan validation.
- Full `pnpm validate:phase17` monorepo typecheck/test/build/lint gate.

## Architecture

- Party remains Master Data and does not own balances, posting, Journal behavior, Sales/Purchase documents, Treasury behavior, or Inventory ownership.
- Customer and Supplier are Party roles rather than duplicated entities.
- Durable `partyId` is distinct from user-facing Party code.
- Future operational modules consume stable Party references without reverse coupling Party to those modules.
- Full network synchronization, PostgreSQL/Web Party adapters, and conflict-resolution workflows remain deferred to Phase 45 and later owning phases.

## Next Phase

Phase 18 — Products and Services.
