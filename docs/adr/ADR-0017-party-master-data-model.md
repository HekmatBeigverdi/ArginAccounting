# ADR-0017 — Party Master Data Model

- Status: Accepted
- Date: 2026-08-30
- Phase: 17 — Parties

## Context

ArginAccounting needs one canonical Master Data identity for people and organizations that may participate in multiple operational roles. Future Sales, Purchases, Treasury, Inventory, API/PostgreSQL, and Argin Bridge synchronization must be able to reference that identity without duplicating Customer/Supplier records or coupling Party to operational/accounting modules.

The desktop runtime is SQLite/offline-first today, but Party identity and Application contracts must survive future multi-store synchronization. Iranian identity/tax attributes, company scope, optimistic concurrency, import provenance, and deletion propagation also require explicit durable semantics.

## Decision

1. **Party is the aggregate/master identity.** Customer and Supplier are roles on one Party. A Party may have both roles simultaneously.
2. **Natural person and legal entity are classifications, not separate master tables or Customer/Supplier entities.** Classification-specific fields are represented through a discriminated Domain model and cannot be changed by ordinary update.
3. **Durable identity is separate from display code.** `partyId` is the stable cross-store reference. `code` and `displayName` are mutable/presentation metadata and must not be used as foreign identity by future documents.
4. **Company scope is explicit at every protected read/write boundary.** Authorization is enforced by Application services/readers, not by UI visibility.
5. **SQLite is an adapter.** Domain/Application contracts expose no SQLite-specific SQL/types and remain implementable by future PostgreSQL, HTTP, or Bridge adapters.
6. **Optimistic concurrency is part of the public mutation contract.** `expectedVersion` and persisted `version` protect mutable Party state.
7. **Business lifecycle and synchronization deletion are distinct.** `active`/`inactive` remains a business status. A synchronization tombstone uses `deletedAt` and carries no business snapshot.
8. **External/source identities are explicit.** Source-system external references are stored separately from Party code and durable Party ID.
9. **Import is diagnostic and optionally atomic.** CSV/XLSX conversion remains an adapter concern; normalization, validation, duplicate semantics, and write atomicity remain Application/Domain concerns.
10. **Operational/accounting modules depend on Party, never the reverse.** Party owns no balances, posting rules, journals, sales/purchase documents, treasury behavior, inventory ownership, or automatic accounting entries.

## Consequences

### Positive

- One customer/supplier master prevents duplicate identity/contact/tax data.
- Later modules can reference a stable `partyId` without cloning Party behavior or UI.
- Offline SQLite and future PostgreSQL/Bridge implementations can share the same Domain/Application contract.
- Tombstones, versions, operation/idempotency metadata, and external references avoid a future Party identity redesign when Phase 45 synchronization is implemented.
- Authorization, audit, duplicate detection, and bulk transfer remain testable without React or network infrastructure.

### Trade-offs

- Consumers must explicitly request required roles/status instead of assuming a dedicated Customer/Supplier table.
- Party code cannot be treated as an immutable database identity.
- Synchronization metadata exists before the synchronization engine; Phase 17 intentionally carries compatibility structure without implementing transport/conflict resolution.
- Audit persistence is a successful mutation side effect and is not transactionally identical to the Party SQLite write in the current Desktop composition; broader cross-store transactional/outbox behavior remains future platform work.

## Rejected Alternatives

### Separate Customer and Supplier masters

Rejected because one real-world person/organization can be both and would otherwise duplicate identity, contacts, tax data, and synchronization identity.

### Use Party code as durable identity

Rejected because display numbering can follow company/business conventions and should not constrain cross-database identity or future synchronization.

### Embed SQLite/network synchronization rules in Party Domain

Rejected because this would violate the database-independent Domain and make future PostgreSQL/API adapters expensive or semantically divergent.

### Couple Party to Accounting balances/posting

Rejected because Party is Master Data. Financial behavior belongs to later operational/accounting bounded contexts that reference Party by stable ID.

## Related Documents

- `docs/phases/phase-17-parties.md`
- `docs/architecture/party-argin-bridge-contract.md`
- `docs/architecture/party-shared-platform-integration.md`
- `docs/adr/ADR-0001-offline-first.md`
- `docs/adr/ADR-0002-database-independent-domain.md`
- `docs/adr/ADR-0005-repository-unit-of-work.md`
- `docs/adr/ADR-0007-immutable-audit-trail.md`
