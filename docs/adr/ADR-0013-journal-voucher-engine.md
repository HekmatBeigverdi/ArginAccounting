# ADR-0013 — Journal Voucher Engine Architecture

- Status: Accepted
- Date: 2026-08-10
- Decision Owners: Project maintainers

## Context

Phase 13 introduces the first persisted journal vouchers and journal lines in ArginAccounting. The engine must become the accounting source of truth for double-entry entries while preserving the boundaries established by earlier phases:

- Phase 09 provides Money, Number Series, transactions, optimistic concurrency, events, correlation/causation metadata, and shared platform contracts.
- Phase 10 provides company-scoped accounts with stable opaque identity, explicit posting eligibility, reporting classification, and protected usage-sensitive changes.
- Phase 11 provides independent accounting dimensions, account-dimension policies, deterministic assignment validation, and dynamic selector contracts explicitly designed for future journal lines.
- Phase 12 provides provenance-oriented, retry-safe and Argin Bridge-compatible patterns but intentionally excludes journals.
- Company/Branch and Fiscal packages provide scope and fiscal-year/period contracts, including `open`, `locked`, and `closed` period states.

The desktop product is local-first with Tauri and SQLite, but the same Domain/Application behavior must later operate behind a .NET API and PostgreSQL and remain suitable for offline synchronization. Journal design therefore cannot depend on SQLite row IDs, React state, Tauri commands, or database-specific sequencing.

Phase 14 owns the final Journal Lifecycle: posting, approval, locking, reversal, replacement, and controlled amendment. Phase 13 must create a complete persisted voucher engine without leaking those lifecycle responsibilities into this phase.

## Decision

### Aggregate boundary

`JournalVoucher` is the aggregate root. A voucher owns its ordered `JournalLine` collection and all line-level accounting-dimension assignments.

A voucher carries stable opaque identity plus explicit:

- company and branch scope;
- voucher number and optional external/manual reference;
- voucher date;
- fiscal year and fiscal period identifiers;
- description;
- source metadata;
- currency context;
- optimistic-concurrency version;
- creation/update timestamps and actor/context metadata where appropriate.

Journal lines are not independently mutated outside the voucher aggregate. Each line has a stable opaque identity, deterministic display/order value, account reference, description, debit/credit values, and dimension assignments.

### Phase 13 status model and Phase 14 boundary

Phase 13 persists vouchers only in an editable `draft` state.

`posted`, `approved`, `reversed`, `replaced`, `locked`, `voided`, or equivalent final lifecycle states are not introduced as active Phase 13 behavior. Those states and transitions belong to Phase 14.

Phase 13 may persist forward-compatible source and version metadata, but it must not implement post/unpost, approval, reversal, locking, or controlled amendment workflows.

### Double-entry invariants

The aggregate enforces the following structural invariants before persistence:

- A voucher contains at least two effective lines.
- Each effective line has a strictly positive amount on exactly one side: debit or credit.
- A line cannot contain both debit and credit.
- Zero-value effective lines are rejected rather than silently persisted.
- Total debit must equal total credit.
- Line ordering is deterministic and unique within a voucher.
- Voucher structural validation is independent from UI and persistence.

Amounts are non-negative. Direction is represented only by debit versus credit.

### Account eligibility

Structural voucher balance is a Domain invariant, while account eligibility is resolved through Application/Domain policy contracts because it requires external aggregates.

Every journal line account must:

- exist;
- belong to the same company as the voucher;
- be active for the operation;
- be a posting-enabled Subsidiary account;
- satisfy any effective-date or integrity restrictions exposed by the account model.

No posting behavior or accounting meaning is inferred from account-code prefixes.

### Fiscal context

The voucher date is stored as canonical Gregorian `YYYY-MM-DD` and presented as Solar Hijri in the UI.

Application orchestration resolves the fiscal year and period covering the voucher date and verifies company scope. Phase 13 mutations are permitted only in an `open` fiscal period. `locked` and `closed` periods reject create/update/delete-draft mutations.

The fiscal identifiers are persisted explicitly on the voucher to preserve deterministic historical context and future reporting/synchronization behavior.

### Accounting dimensions

Phase 13 reuses the Phase 11 assignment-validation contract rather than defining a second journal-specific dimension rules engine.

For every line, assignments are validated against:

- the selected account;
- company scope;
- voucher/document date;
- active dimension types and members;
- `required`, `optional`, and `forbidden` account-dimension policies;
- member/type compatibility;
- effective dates;
- multiplicity and duplicate rules.

Persisted line assignments reference stable dimension type/member identifiers. Journal-backed usage readers introduced in Phase 13 become authoritative evidence for protecting destructive Phase 10/11 account and dimension changes.

### Numbering

Journal voucher numbers use the existing fiscal Number Series application contract.

The entity type for Phase 13 journal vouchers is a stable application constant. Applicable series resolution uses company, branch, fiscal year, and entity type according to the existing Number Series rules.

Number allocation occurs inside the mutation transaction boundary so the committed voucher and its reserved number remain consistent. Application code must not generate voucher numbers from local row IDs or timestamps.

A caller-supplied external/manual reference is distinct from the system voucher number and does not replace Number Series identity.

### Currency representation

Iranian Rial remains the default product presentation currency. Phase 13 keeps currency context explicit so the aggregate is not permanently coupled to a single currency.

Base double-entry balance is enforced on canonical voucher debit/credit amounts. Multi-currency realization, exchange differences, revaluation posting, and FX gain/loss workflows remain outside Phase 13 unless already required by existing shared Money contracts.

### Source and traceability

A voucher records source metadata independently from source modules. Manual entry is one source; future Sales, Purchase, Inventory, Treasury, Payroll, Tax, migration, and integration modules may create posting requests through stable contracts in later phases.

Source metadata must be sufficient to preserve:

- source type;
- optional source aggregate/document identifier;
- caller/request identity where required;
- actor;
- correlation ID;
- causation ID.

The Journal domain does not depend on any source module's internal model.

### Application boundary

Application services own:

- authorization;
- company/branch scope checks;
- account lookup and eligibility policy;
- fiscal context resolution;
- dimension assignment validation;
- Number Series reservation;
- optimistic-concurrency checks;
- Unit of Work orchestration;
- audit evidence;
- post-commit integration-event publication.

Domain/Application public contracts remain independent from React, Tauri, SQLite, PostgreSQL, .NET transport, and filesystem concerns.

### Persistence and atomicity

A Journal Voucher is persisted atomically with all lines and line-dimension assignments.

Create, update, and delete-draft operations run inside the Accounting Unit of Work. A failure at any point rolls back every journal table mutation in that operation.

Mutable voucher aggregates use optimistic concurrency with a monotonically increasing version. Repository APIs accept expected-version semantics rather than exposing SQLite-specific row-version mechanisms.

Integration success events are emitted only after successful commit.

### Usage integrity

Before Phase 13, account and dimension modules may rely on placeholder or adapter-level usage readers because no persisted journals existed. Phase 13 introduces journal-backed usage detection.

An account or dimension member/type referenced by persisted journal lines is considered used for the integrity contracts of Phase 10/11. Usage detection is exposed through query-oriented ports, not by making Account or Dimension aggregates depend on Journal persistence.

### Argin Bridge compatibility

- All durable entity identifiers are stable and opaque.
- Company and branch scope are explicit.
- Dates/timestamps use Gregorian canonical values; Jalali conversion is presentation-only.
- Commands are deterministic and transactionally retry-safe where required.
- Number Series, expected versions, request/correlation metadata, and source identifiers provide future synchronization evidence.
- Journal Domain/Application code does not depend on SQLite-specific SQL, local autoincrement identities, Tauri, React, PostgreSQL, or HTTP.
- The relational persistence shape must be reproducible by a future PostgreSQL adapter.

## Consequences

### Positive

- The Journal Voucher becomes a clean accounting aggregate rather than a UI form mapped directly to tables.
- Double-entry invariants are enforced before persistence.
- Existing Phase 09–11 contracts are reused instead of duplicated.
- Journal-backed usage detection closes the integrity gap for Account and Dimension protected changes.
- The Phase 13 implementation remains portable to the Argin Bridge server architecture.
- Phase 14 can add posting/approval/reversal lifecycle without redesigning basic voucher structure.

### Trade-offs

- Voucher creation requires orchestration across Account, Fiscal, Dimension, Number Series, authorization, and transaction boundaries.
- Persisting fiscal IDs in addition to voucher date duplicates derivable context, but intentionally preserves deterministic historical context.
- Reserving numbers transactionally may create infrastructure complexity around concurrency and future distributed synchronization.
- Line dimension assignments add additional persistence and validation work compared with a flat journal-line table.

### Risks and mitigations

- **Unbalanced data:** aggregate validation rejects it before persistence and SQLite receives supporting durable constraints where practical.
- **Stale account/dimension state:** eligibility and assignment validation occur inside application orchestration before commit; optimistic checks protect mutable aggregates where available.
- **Period changes during mutation:** fiscal validation and journal persistence share a transactional application boundary as far as the local adapter can guarantee.
- **Duplicate voucher numbers:** existing Number Series reservation plus database uniqueness protect committed numbering.
- **Lifecycle leakage:** Phase 13 exposes only draft mutation behavior; all posting/approval/reversal transitions are deferred to ADR/implementation work in Phase 14.
- **Future sync replay:** stable IDs, source/request identity, optimistic versions, and correlation metadata provide reconciliation evidence without SQLite-only assumptions.

## Alternatives Considered

### Put journal lines in a separate aggregate

Rejected. Balance, ordering, and line assignment validity are voucher-level consistency rules and must commit atomically with the voucher.

### Allow both debit and credit columns to be non-zero and validate only totals

Rejected. It obscures accounting direction and permits semantically invalid lines.

### Infer fiscal period only at query/report time

Rejected. Persisting fiscal context makes historical behavior deterministic and protects later reporting, closing, and synchronization workflows from changed calendar configuration.

### Generate document numbers from SQLite AUTOINCREMENT

Rejected. It couples business numbering to one persistence engine and breaks branch/fiscal-year Number Series behavior and future Argin Bridge portability.

### Implement posting and reversal in Phase 13

Rejected. The roadmap separates the persisted Journal Voucher Engine from Journal Lifecycle. Combining them would enlarge the aggregate transition surface before persistence and integrity foundations are proven.

### Duplicate Phase 11 dimension validation inside Journal

Rejected. Phase 11 intentionally supplies reusable assignment-validation contracts. A second engine would create inconsistent policy behavior.

### Let source modules persist journal tables directly

Rejected. Sales, Purchase, Inventory, Treasury, Payroll, Tax and other modules must integrate through future stable posting contracts so Journal remains the accounting authority.

## Implementation Notes

- Phase 13 starts with Domain model and validation policies before SQLite schema implementation.
- Journal Number Series integration uses the existing Fiscal application/repository contracts rather than a new journal-only sequence table.
- Journal-backed usage readers will satisfy existing Account/Dimension integrity ports without creating reverse Domain dependencies.
- SQLite schema will persist voucher header, ordered lines, and normalized line-dimension assignments.
- Persian RTL presentation uses Solar Hijri dates and Iranian Rial formatting while durable values remain canonical.

## Related Documents

- [Phase 13 — Fixed Implementation Plan](../phases/phase-13-journal-voucher-engine-plan.md)
- [Accounting Engine](../accounting/accounting-engine.md)
- [ADR-0010 — Chart of Accounts Model](ADR-0010-chart-of-accounts-model.md)
- [ADR-0011 — Independent Accounting Dimensions](ADR-0011-independent-accounting-dimensions.md)
- [ADR-0012 — Versioned Coding Templates](ADR-0012-versioned-coding-templates.md)
- [ADR-0005 — Repository and Unit of Work](ADR-0005-repository-unit-of-work.md)
- [ADR-0009 — Platform Infrastructure First](ADR-0009-platform-infrastructure-first.md)
