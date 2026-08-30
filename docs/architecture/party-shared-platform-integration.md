# Party Shared Platform and Accounting Integration Boundary

## Purpose

Phase 17 Step 15 integrates the Party bounded context with existing ArginAccounting platform capabilities without turning Party Master Data into an accounting or infrastructure-owned model.

## Shared platform alignment

Party uses the existing repository-wide patterns rather than introducing parallel infrastructure:

- Company scope is explicit on every Party command/query and is enforced at the Application boundary.
- Correlation and request identifiers flow through `PartyCommandContext` / authorization / audit metadata.
- Durable timestamps remain ISO/Gregorian values and are formatted only at presentation boundaries.
- Paged Party reads and bounded selectors avoid unbounded Master Data loading.
- Optimistic concurrency remains explicit through `expectedVersion` and SQLite `version` predicates.
- Stable Party ids remain independent from display codes and SQLite row numbering.
- Argin Bridge synchronization metadata remains the contract established by Step 10; Step 15 does not introduce network transport.

No additional Party notification or domain-event stream is introduced in Step 15 because there is no current consumer that justifies another durable or in-memory event contract. Future modules may publish or consume events through the shared Platform event bus when concrete workflows require them.

## Shared Audit composition

Party security boundaries emit persistence-neutral `PartyAuditEvent` values. Desktop composition maps those events to the canonical `@argin/audit` model and persists them through `@argin/audit-tauri`.

The mapping is:

| Party action | Shared Audit action |
| --- | --- |
| `party.create` | `create` |
| `party.update` | `update` |
| `party.change-status` | `status-change` |
| `party.add-role` | `assign` |
| `party.remove-role` | `unassign` |
| `party.import` | `import` |
| `party.export` | `export` |

Each record retains the real Party actor, company scope, Party target id, correlation id, request id, occurrence time, and operation metadata. The Audit writer is an internal cross-cutting consequence of an already-authorized Party command, so users do not need a separate `audit.entries.record` permission merely for their successful Party mutation to be recorded.

## Accounting boundary

Party is Master Data and does not own accounting behavior. Phase 17 therefore does **not** add any of the following to `@argin/party`:

- balances or opening balances;
- journal lines or voucher posting;
- posting rules;
- account/dimension ownership;
- sales or purchase document behavior;
- treasury, cheque, inventory, or settlement logic.

Operational/accounting modules reference Party in the forward direction through the stable `partyId` exposed by `PartySelectionReference`. `Party.code` and `displayName` are presentation metadata and must not replace the durable Party id as a foreign/reference identity.

This keeps the dependency direction conceptually:

`Sales / Purchases / Treasury / future documents -> Party reference contract`

and not:

`Party -> Sales / Purchases / Treasury / Accounting documents`

## Deferred work

- Concrete Sales/Purchases/Treasury document schemas remain their own roadmap phases.
- Cross-device synchronization remains Phase 45.
- Broader architecture/documentation consolidation remains Phase 17 Step 19.
- Performance/accessibility/complete monorepo validation remains Step 18.
