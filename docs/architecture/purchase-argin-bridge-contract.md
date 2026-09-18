# Purchase Argin Bridge Synchronization Contract

## Status

Phase 22 Step 18 freezes the wire-neutral synchronization contract for Purchase authoritative facts.

This step does **not** implement transport, outbox workers, background polling, push/pull networking, remote acknowledgement persistence, PostgreSQL/.NET endpoints, retry/backoff scheduling, online/offline state or conflict-resolution UI.

Target direction:

`Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`

## Contract Version

The Purchase synchronization contract version is `1`.

Every consumer must inspect `contractVersion`. Silent wire-shape changes are prohibited.

## Authoritative Sync Families

Purchase exposes four authoritative envelope families:

1. `purchase-document`
2. `purchase-commercial-fact`
3. `purchase-receipt-invoice-match`
4. `purchase-valuation-cost-input`

Purchase document envelopes contain the aggregate header and its durable line snapshots. Purchase lines therefore do not need an independent top-level transport envelope.

The following are **not** authoritative synchronization entities:

- receipt/invoice matching summary/status;
- unresolved-cost derived status;
- document totals/projections that can be recalculated;
- Inventory on-hand projections;
- FIFO/MWA valuation layers/states;
- reporting rows.

Those values are rebuilt from accepted authoritative facts.

## Mandatory Metadata

Every Purchase envelope carries:

- `contractVersion`;
- `operationId`;
- `requestId`;
- `payloadFingerprint`;
- canonical UTC `changedAt`;
- origin `sourceSystem` and optional `sourceInstanceId`;
- nullable positive `serverRevision`;
- optional normalized external references.

Step 17 remains authoritative for the local mutation identity: request ID + operation ID + payload fingerprint.

The Bridge contract does not invent a second local idempotency identity.

## Local Version and Local Revision

Purchase document aggregates carry positive `localVersion`, equal to the Purchase optimistic aggregate version represented by the snapshot.

Commercial Facts carry positive `localRevision`, equal to their Purchase commercial revision.

Receipt/Invoice Match is immutable and always has `localRevision = 1`.

Purchase Valuation Cost Input carries an explicit positive `localRevision`. A later controlled replacement for the same Inventory movement uses a later revision rather than last-write-wins by timestamp.

`serverRevision` is remote acknowledgement/canonical-server metadata only. It must never replace or masquerade as local aggregate version/revision.

## Purchase Document Envelope

### Upsert

`PurchaseDocumentSyncUpsertEnvelope` carries:

- durable Company/Branch/document identity;
- display document number only as non-identity metadata;
- complete validated Purchase document snapshot;
- local optimistic version;
- explicit upstream dependencies.

A document upsert is validated by rehydrating through Purchase Domain invariants.

Dependencies include:

- Branch;
- Fiscal Year;
- Fiscal Period;
- Supplier Party;
- every Product/Service master referenced by a Purchase line;
- original Purchase document for return/correction documents.

The dependency on the original document is especially important for correction chains. A return/correction cannot be applied remotely before the referenced original Purchase document is known.

### Tombstone

A Purchase tombstone represents only a real synchronization deletion.

Only a last-known `draft` document may produce a tombstone.

These business states are **not deletions** and must never produce tombstones:

- cancelled;
- confirmed;
- returned;
- corrected.

Purchase return and Purchase correction are normal durable Purchase document upserts with explicit `correctionReference`.

The current Phase 22 Application surface does not introduce a Purchase delete command. The tombstone shape is frozen now for future safe Draft deletion/synchronization compatibility; it is not a hidden deletion path.

## Commercial Fact Envelope

`PurchaseCommercialFactSyncEnvelope` carries the normalized authoritative commercial snapshot for one Purchase line and its local revision.

Dependencies:

- owning Purchase document;
- owning Purchase line.

The receiver must not synthesize quantity, unit, price, discount, charge, tax or currency from Inventory/Valuation. Purchase remains their authority.

For the same Company + Purchase document + line:

- same revision + same accepted payload -> acknowledge/replay;
- same revision + different payload -> conflict;
- later revision must preserve controlled Purchase correction semantics;
- timestamps alone never choose the winner.

## Receipt/Invoice Match Envelope

`PurchaseReceiptInvoiceMatchSyncEnvelope` is an immutable revision-1 fact.

Dependencies:

- supplier-invoice Purchase document;
- supplier-invoice Purchase line;
- confirmed Inventory receipt document;
- Inventory receipt line;
- Product master.

The receiver must not accept the Match before both Purchase and Inventory sides are resolvable.

For one `matchId`:

- same immutable payload -> replay/acknowledge;
- different payload -> conflict;
- no update/delete/last-write-wins mutation is allowed.

Matching summary remains derived and is not synchronized independently.

## Valuation Cost Input Envelope

`PurchaseValuationCostInputSyncEnvelope` carries Purchase-owned provenance for a resolved inbound cost input.

Dependencies include:

- authoritative Inventory movement;
- owning Inventory receipt document and line;
- Product;
- Warehouse;
- every Purchase Match source;
- every source Purchase document and line.

The envelope does not contain FIFO/MWA layers or valuation state.

A receiver must establish all dependencies before accepting the Cost Input as usable valuation input.

For the same Company + Inventory movement:

- same local revision + same payload -> replay/acknowledge;
- same local revision + different payload -> conflict;
- higher controlled revision may supersede the prior Purchase Cost Input;
- valuation recalculation is triggered from authoritative Cost Input change, not from delivery timestamp ordering.

## Dependency Ordering

Bridge delivery order is not business authority.

Required logical order is:

`Master Data -> Purchase Document -> Commercial Fact -> Inventory Receipt/Movement -> Match -> Cost Input -> Rebuildable Valuation/Reports`

Not every transport batch needs to physically arrive in that order, but an apply adapter must defer facts whose dependencies are missing.

## Idempotency and Conflict Semantics

Expected future apply semantics:

- same request/operation identity + same payload fingerprint -> replay/acknowledge;
- same request/operation identity + different fingerprint -> conflict;
- same immutable Match ID + different payload -> conflict;
- same immutable Purchase document version under a different payload -> conflict;
- same Commercial Fact or Cost Input revision + different payload -> conflict;
- higher editable revision/version is not automatically accepted through timestamp-based last-write-wins;
- confirmed/immutable facts are never merged destructively.

Step 18 freezes these rules but does not implement the remote apply engine.

## No Last-Write-Wins for Confirmed Purchase Facts

Remote reconciliation must never silently:

- rewrite a confirmed supplier invoice;
- mutate an immutable Receipt/Invoice Match;
- delete a Purchase document because a return/correction exists;
- turn a correction into replacement of historical source facts;
- overwrite Cost Input solely because `changedAt` is newer;
- overwrite local optimistic version with `serverRevision`.

Corrections remain new linked Purchase facts. Controlled Cost Input replacement uses explicit revision and causes valuation recalculation.

## Historical Fiscal Scope

Purchase document snapshots carry captured Fiscal scope evidence:

- Fiscal Year/Period durable IDs;
- captured date ranges;
- captured statuses;
- captured historical lock-through date.

The Bridge transports these historical facts as part of the Purchase document snapshot.

A receiver may separately enforce its current Fiscal mutation policy, but must not rewrite historical captured scope from current Fiscal state.

## Origin and External References

`origin.sourceSystem` identifies the system producing the envelope.

Optional `sourceInstanceId` distinguishes installations/devices.

External references are metadata mappings only and do not replace Argin durable identities.

Duplicate source-system/external-ID references in one envelope are rejected.

## Argin Bridge Boundary

Future adapters may project these contracts into:

- SQLite incremental change readers;
- durable outbox/change feeds;
- Argin Bridge transport;
- .NET application/API DTOs;
- PostgreSQL persistence;
- remote apply/acknowledgement workers.

The canonical Purchase contract contains no:

- URL or HTTP method;
- queue row ID;
- retry counter;
- backoff duration;
- socket state;
- authentication token;
- device-online state.

Those belong to transport/infrastructure.

## Existing SQLite Readiness

Phase 22 Steps 15–17 already reserve synchronization metadata on authoritative Purchase tables:

- `sync_origin`;
- nullable `server_revision`;
- `sync_changed_at`;
- durable request/operation/fingerprint replay evidence.

No additional Step 18 migration is required solely to define the wire-neutral contract.

A later outbox/checkpoint implementation may require infrastructure-owned persistence, but that is intentionally outside Phase 22 Step 18.

## Verification Boundary

Step 18 adds focused contract tests for:

- document version and dependency generation;
- Draft-only tombstone policy;
- Commercial Fact revision;
- immutable Match dependency graph;
- Cost Input dependency graph/revision;
- return/correction synchronization as upsert rather than deletion.

Full cross-store apply, restart, dependency-deferral and Bridge integration testing remains Step 23. Final monorepo validation remains Step 24.
