# Phase 17 Step 19 — Documentation, ADR, and Validation Evidence

## Status

Completed.

## Permanent Documentation Added or Reconciled

- `docs/phases/phase-17-parties.md` — permanent Phase 17 implementation summary.
- `docs/adr/ADR-0017-party-master-data-model.md` — accepted architecture decision for canonical Party identity, role model, persistence-neutral boundaries, concurrency, tombstones, external references, and dependency direction.
- `docs/adr/README.md` — ADR registry reconciled through ADR-0017, including the previously omitted ADR-0016 registry entry.
- `docs/database/database-design.md` — Party migrations, stable ID/display-code separation, indexing/query-plan policy, transaction boundaries, tombstone/external-reference compatibility, and future PostgreSQL/Bridge expectations.
- `docs/database/database-dictionary.md` — canonical entries for `parties`, `party_roles`, `party_contacts`, `party_addresses`, and `party_external_references`.
- `docs/security/party-security.md` — Party permissions, company scope, Application authorization, shared Audit mapping, Approval decision, and sensitive-master-data guidance.
- `docs/glossary.md` — Phase 17 Party, role, identity, selector, concurrency, tombstone, external-reference, and idempotency terms.
- `docs/phases/phase-17-step-18-validation-evidence.md` — local validation result changed from pending to repository-owner-confirmed green, including the accepted tsconfig correction for the performance script.

## Architecture Documentation Reviewed

The following existing Phase 17 documents remain authoritative and require no replacement:

- `docs/architecture/party-argin-bridge-contract.md`
- `docs/architecture/party-shared-platform-integration.md`

They separate current Desktop/SQLite behavior from future Phase 45 synchronization and document dependency direction toward future operational modules.

## Migration Matrix

| Migration | Purpose | Status |
| --- | --- | --- |
| `0016_parties.sql` | Party aggregate, roles, contacts, addresses, uniqueness and query indexes | Registered and validated |
| `0017_party_sync_metadata.sql` | `deleted_at`, external references, sync-change/tombstone indexes | Registered and validated |

## Permission Matrix

| Permission | Capability |
| --- | --- |
| `master-data.parties.view` | Read/list/detail/select Parties |
| `master-data.parties.create` | Create Party master |
| `master-data.parties.update` | Update Party profile |
| `master-data.parties.change-status` | Activate/deactivate Party |
| `master-data.parties.manage-roles` | Add/remove Customer/Supplier roles |
| `master-data.parties.import` | Preview/execute Party import |
| `master-data.parties.export` | Export Party data |

Authorization remains at the Application boundary; UI gates are not security controls.

## Test and Validation Matrix

- Domain aggregate/classification/identity/contact/address tests: covered.
- Application CRUD, duplicates, idempotent replay, stable errors, optimistic concurrency: covered.
- Security and Audit boundaries: covered.
- SQLite repository/UoW/query/concurrency/error mapping: covered.
- Migration constraints/index registration and sync metadata: covered.
- CSV/XLSX codec, preview, atomic import, bounded export: covered.
- Desktop Party workspace, Persian error presentation, selector, import regression: covered.
- Accessibility/keyboard/RTL/density contracts: covered.
- Representative 50,000-Party SQLite query-plan validation: covered.
- Full Phase 17 `typecheck/test/build/lint` validation: confirmed green by repository owner before Step 19.

## ADR Threshold Review

One Phase 17 ADR is justified: Party identity/role/stable-reference and synchronization-compatible persistence semantics are long-lived architectural decisions affecting future modules and storage adapters. A separate ADR for every UI/import detail is not justified; those are implementation contracts documented in Phase/architecture documents.

## Explicit Non-Scope Confirmation

Phase 17 documentation does not claim delivery of customer/supplier balances, opening balances, Sales/Purchases/Treasury documents, inventory ownership, posting rules, automatic journals, PostgreSQL runtime, network Bridge transport, conflict-resolution UI, or Phase 45 synchronization.

## Exit Result

Phase 17 public contracts and architectural decisions are documented with migration, permission, and validation evidence. Step 19 exit criteria are satisfied. Step 20 remains the only open step and owns final status reconciliation, roadmap/changelog/release preparation, scope review, merge, and semantic release work.
