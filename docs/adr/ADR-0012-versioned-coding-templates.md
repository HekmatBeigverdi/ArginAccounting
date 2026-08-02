# ADR-0012 — Versioned Coding Templates

- Status: Accepted
- Date: 2026-08-02
- Decision Owners: Project maintainers

## Context

ArginAccounting must provision a useful Iranian Chart of Accounts for service, trading, and manufacturing companies without turning the operational account tree into shared mutable seed data. Phase 10 made accounts company-scoped and Phase 11 made accounting dimensions independent from that tree. Coding templates must compose those contracts, support the supplied Tadbir-inspired coding references and Excel samples, and remain safe for existing companies with locally customized coding.

The desktop product is local-first on SQLite. The same domain workflow must later operate through the Argin Bridge with a .NET API, PostgreSQL, and offline synchronization. Consequently, template behavior cannot depend on SQLite row identifiers, Tauri commands, React state, filesystem paths, or an in-process-only transaction model.

## Decision

Coding templates are versioned, company-independent definitions. Applying a template creates or relates company-scoped operational entities through an explicit, previewed, atomic command.

### Ownership and lifecycle

- A template is either `built_in` or `custom` and has a stable opaque identifier, normalized stable code, Persian and optional English names, supported company activity type, and lifecycle state.
- Built-in definitions are maintained only by privileged system administration. Company users may view and apply published built-in versions but cannot mutate them.
- Custom templates follow `draft`, `published`, and `retired` lifecycle states.
- Draft content is editable with optimistic concurrency. Publishing creates an immutable numbered version. Published content is never edited in place.
- Retirement prevents new recommendations and applications but preserves versions, histories, mappings, and audit evidence.

### Version content

- Each version is a complete validated graph, not an unordered list of SQL seed rows.
- Items use stable logical keys. Parent and policy references use logical keys so definitions are portable across SQLite, PostgreSQL, exported workbooks, and synchronized replicas.
- Account items contain explicit level, parent, nature, normal balance, statement classification, posting flags, status defaults, and management tags. Accounting meaning is never inferred only from a numeric code.
- Dimension types, dimension members, and account-dimension policies reuse the Phase 11 model and remain independent from account hierarchy.
- Source provenance records template identity, version, catalog or workbook origin, contract version, and content fingerprint.

### Company activity and recommendation

- Company activity type is one of `service`, `trading`, `manufacturing`, or `custom`.
- Existing companies migrate to `custom`; this is an explicit compatibility value, not an inferred activity.
- Activity type produces a recommendation only. A template is never applied during company creation or activity-type change without a complete preview and explicit confirmation.

### Preview, conflicts, and application

- Preview is a deterministic, read-only plan generated from a template version and the current company baseline.
- Every item is classified as `create`, `compatible_existing`, `conflict`, `skipped`, or `invalid`, with stable issue codes suitable for Persian presentation.
- Conflicts include company scope, duplicate code, logical key, hierarchy, classification, account behavior, dimension reference, and policy incompatibility.
- Apply accepts an unexpired preview identity or equivalent baseline fingerprint, explicit confirmation, actor and company context, and a caller-supplied request key.
- Application runs behind an Accounting Unit of Work. Accounts, dimensions, policies, application history, and item mappings commit together or all roll back.
- The request key is idempotent within company scope. A retry returns the recorded result and cannot create duplicate operational data.
- Integration events are written only after a successful commit and contain actor, company, correlation, causation, request, template, version, and application identifiers.

### Upgrade and local drift

- Upgrades compare the previously applied immutable version, the target version, stored item mappings, and current operational state.
- Items are classified as unchanged, locally modified, newly available, conflicting, or retired by the newer definition.
- Only explicitly selected additive compatible actions may be applied automatically.
- Local operational changes remain authoritative. Upgrade never silently overwrites, renames, reparents, deactivates, or deletes them.
- Accepted, skipped, and conflicting actions are retained in upgrade history.

### Excel boundary

- Excel is an input adapter for producing a draft template version; it is not a separate account-import domain path.
- A versioned workbook contract defines fixed sheets, columns, logical keys, data types, enumerations, limits, and cross-sheet references.
- The parser boundary emits normalized template input plus cell-addressed errors and does not expose spreadsheet-library objects to Domain or Application layers.
- Persian and Arabic digits and whitespace are normalized. Formula cells are rejected where literal stored values are required.
- Built-in catalogs and workbook imports pass through the same graph validator, preview engine, conflict rules, and atomic application workflow.
- Import batches use a caller-supplied identity and file fingerprint. Invalid or repeated confirmed batches cannot create partial or duplicate state.

### Argin Bridge compatibility

- Identifiers are opaque and stable; company scope and source provenance are explicit.
- Commands are deterministic and retry-safe and do not rely on database-generated sequential identity.
- Durable timestamps use Gregorian ISO values; Jalali conversion is presentation-only.
- Domain and Application packages remain independent from React, Tauri, SQLite, PostgreSQL, transport, and spreadsheet libraries.
- Repository, transaction, authorization, clock, identifier, catalog, parser, and event boundaries are explicit ports.
- Optimistic versions, application/import request keys, content fingerprints, item mappings, and correlation metadata provide future synchronization conflict evidence.

## Consequences

### Positive

- Companies receive suitable Iranian coding without sharing mutable operational rows.
- Published templates and past applications remain reproducible and auditable.
- Built-in and Excel-sourced coding follow one validation and application path.
- Existing company customization is protected during application and upgrade.
- SQLite desktop behavior can be reproduced by future PostgreSQL/API adapters.

### Negative

- Preview and application require additional histories, mappings, fingerprints, and transaction boundaries.
- A complete graph validator is required before persistence adapters can be finished.
- Template upgrades are deliberately interactive and cannot be reduced to replacing seed rows.

### Risks

- Catalog mistakes could be distributed widely; snapshot, accounting-classification, and graph-integrity tests are mandatory.
- A baseline may change between preview and apply; baseline fingerprints and optimistic checks must reject stale plans.
- Large workbooks may consume excessive resources; the contract must enforce file, sheet, and row limits before full parsing.
- Future synchronization could replay an apply/import command; scoped idempotency keys and immutable histories must be durable.

## Alternatives Considered

- Insert fixed account rows during company creation: rejected because it hides confirmation, cannot describe conflicts, and couples creation to one catalog version.
- Treat templates as mutable global account trees: rejected because prior applications become irreproducible and company customization can leak across scopes.
- Infer a template from account-code prefixes: rejected because accounting meaning and reporting classification are explicit Phase 10 properties.
- Import Excel directly into operational account tables: rejected because it bypasses graph validation, preview, common conflict handling, and atomic application history.
- Make company activity type automatically select and apply coding: rejected because recommendation and explicit user confirmation are separate responsibilities.
- Build SQLite-specific orchestration first: rejected because it would make PostgreSQL/API and offline synchronization behavior diverge.

## Implementation Notes

- Company activity compatibility is implemented before template aggregates; persistence joins migration `0012_coding_templates.sql` in the fixed Phase 12 sequence.
- Built-in service, trading, and manufacturing catalogs are canonical source data validated by the same domain validator.
- Operational entities retain their Phase 10/11 company scope and receive template source provenance through application mappings.
- Journal vouchers, balance migration, and destructive code remapping remain outside Phase 12.

## Related Documents

- [Phase 12 — Fixed Implementation Plan](../phases/phase-12-coding-templates-plan.md)
- [ADR-0010 — Chart of Accounts Model](ADR-0010-chart-of-accounts-model.md)
- [ADR-0011 — Independent Accounting Dimensions](ADR-0011-independent-accounting-dimensions.md)
- [ADR-0001 — Offline First](ADR-0001-offline-first.md)
- [ADR-0005 — Repository and Unit of Work](ADR-0005-repository-unit-of-work.md)
