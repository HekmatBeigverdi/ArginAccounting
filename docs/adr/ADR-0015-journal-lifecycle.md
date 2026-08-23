# ADR-0015 — Journal Lifecycle Architecture

- Status: Accepted
- Date: 2026-08-23
- Decision Owners: Project maintainers

## Context

Phase 13 established `JournalVoucher` as the persisted double-entry aggregate and deliberately limited it to Draft behavior. Phase 15 must add approval, posting, locking, controlled amendment, reversal, and traceability without weakening the accounting invariants already established by ADR-0013.

The repository already contains a generic Approval Workflow from Phase 08 with its own request state machine, optimistic concurrency, append-only history, authorization, and atomic persistence. Phase 09 provides shared Unit of Work, idempotency, event, notification, and optimistic-concurrency infrastructure. Phase 14 provides the canonical Persian RTL desktop presentation contract. Fiscal year/period eligibility remains authoritative for accounting mutations and posting.

The lifecycle design must remain portable from the current local-first Tauri/SQLite adapter to the future PostgreSQL/.NET API and synchronization architecture. It must also prevent contradictory approval/accounting states, stale-client transitions, duplicate posting/reversal effects, and destructive mutation of posted accounting facts.

## Decision

### Aggregate and state ownership

`JournalVoucher` remains the accounting aggregate root and is the sole authoritative owner of Journal accounting lifecycle state. Journal lines and dimension assignments remain owned by the voucher aggregate.

The generic Phase 08 `ApprovalRequest` remains a separate reusable aggregate. Accounting does not copy its state machine into the Journal domain. Approval state is approval evidence; Journal lifecycle state is accounting state. Application orchestration coordinates the two where a Journal transition depends on approval.

The Journal lifecycle states selected for Phase 15 are:

```text
draft
  └─ submit-for-approval ─────────────→ pending_approval

pending_approval
  ├─ approval approved ───────────────→ approved
  ├─ returned-to-draft ───────────────→ draft
  ├─ approval rejected ───────────────→ draft
  └─ approval cancelled ──────────────→ draft

approved
  ├─ post ────────────────────────────→ posted
  └─ reopen-for-amendment ────────────→ draft

posted
  └─ reverse ─────────────────────────→ reversed

reversed
  └─ no further accounting-state transition
```

`reversed` is terminal for the original voucher. A reversal is represented by a separate balanced Journal Voucher with durable lineage to the original. The original voucher's accounting lines are never rewritten.

### Approval versus posting

Approval and posting are distinct business decisions.

- `pending_approval` means the voucher is locked for ordinary editing while a linked Approval Request is pending.
- `approved` means an approval decision exists and the voucher is eligible to be considered for posting, but it is not yet part of final posted accounting facts.
- `posted` means final authoritative posting validation has succeeded and posting evidence has been committed.
- An Approval Request reaching `approved` does not itself post the voucher.
- A voucher may not be posted from `draft` or `pending_approval`.

Phase 15 initially requires approval before manual Journal posting. A configurable approval-bypass policy is not introduced unless an existing canonical policy contract already supports it without adding a parallel policy engine. Future source-document posting may define separate policy through later Posting Engine phases.

When a previously approved but unposted voucher is reopened for amendment, its prior approval remains historical evidence but is no longer valid authorization for the modified content. The voucher returns to `draft`; a later resubmission creates or links a new approval cycle rather than reusing the old approval as current approval evidence.

### Transition authority and preconditions

Every lifecycle mutation is an explicit Application command carrying the voucher ID, actor/context, expected voucher version, and request/idempotency identity where duplicate execution could cause repeated effects.

Domain code owns legal Journal state transitions. Application orchestration owns cross-aggregate and external preconditions including authorization, approval evidence, fiscal/account/dimension eligibility, persistence, audit, idempotency, and post-commit events.

All transitions require:

- a current, matching expected voucher version;
- company/branch scope consistency;
- an authorized actor for the specific operation;
- a legal source Journal state;
- required request/correlation/causation metadata where applicable.

Posting additionally requires a linked current approval outcome for the exact unmodified voucher version, authoritative revalidation of double-entry balance, account eligibility, dimension requirements, voucher/fiscal dates, and open posting-eligible fiscal context immediately before commit.

Reversal additionally requires the original voucher to be `posted`, no prior successful reversal, an eligible reversal date/fiscal context, a balanced inverse voucher, and durable original/reversal lineage.

### Locking and mutability

Ordinary content editing is allowed only in `draft`.

`pending_approval`, `approved`, `posted`, and `reversed` are locked against ordinary line/header mutation and deletion.

`approved` may be returned to `draft` only through the explicit controlled amendment command with audit evidence; this invalidates the approval for current-content purposes.

`posted` and `reversed` accounting facts are immutable. Corrections occur through reversal and, when required, a separate replacement/correcting voucher. Lifecycle metadata and append-only audit evidence may continue to accumulate without modifying the posted lines themselves.

### Reversal and lineage

Reversal never negates a posted voucher by editing or deleting it. It creates a new voucher whose accounting effect is the exact inverse of the original eligible posted voucher.

The relationship is durable and queryable through explicit identifiers, including at minimum original voucher ID and reversal voucher ID. Where a correcting/replacement voucher is later created, replacement lineage is also explicit rather than inferred from description text.

A successfully reversed original voucher transitions to `reversed` only in the same atomic operation that commits the reversal voucher and lineage. Retry with the same idempotency identity returns the existing successful outcome rather than creating another reversal.

### Approval coordination

Phase 08 Approval remains the authoritative approval subsystem. Journal lifecycle operations use its public contracts and append-only history.

Submission coordinates Journal `draft -> pending_approval` with creation/submission of the corresponding Approval Request. Approval, rejection, return, or cancellation then drive the corresponding Journal transition through an Application orchestration boundary.

The design must prevent a committed state where a Journal voucher says `approved` while the linked current Approval Request is not approved, or where a voucher remains `pending_approval` after a committed return/reject/cancel action. On the local SQLite implementation, writes that jointly change Journal and Approval state must share an atomic transaction boundary or an equivalent repository-level atomic coordinator.

### Optimistic concurrency and idempotency

Journal expected-version checks remain mandatory for every state-changing command. Approval expected-version checks remain mandatory for Approval actions.

Commands whose retry could duplicate durable effects must use durable request/idempotency identity. This includes submission, posting, reversal, and any cross-aggregate lifecycle command that creates approval/history/audit/event records.

Stale version is a deterministic business failure and must require reload/retry from fresh state. Idempotent replay of an already committed command must not append duplicate approval history, audit-success records, posting evidence, reversal vouchers, or integration events.

### Atomicity and event ordering

Multi-write lifecycle commands are atomic. Examples include:

- Journal state + Approval Request/history + audit evidence on submission/decision coordination;
- Journal posting state + posting evidence + audit evidence;
- reversal voucher + original lifecycle state + lineage + audit evidence.

Integration events are published only after successful commit. A failed transaction publishes no success event and leaves no partial lifecycle result.

### Audit evidence

Every lifecycle attempt records sufficient evidence according to the project's audit/security conventions. Successful transitions capture at least voucher identity, previous/new state, actor, timestamp, company/branch/fiscal context, request identity where relevant, correlation/causation identifiers, and linked approval/posting/reversal identifiers where relevant.

Authorization denial and deterministic rejected attempts are recorded where the existing audit policy requires them, without producing success integration events.

Approval history remains owned by the Approval subsystem; Journal audit evidence references approval identity rather than duplicating Approval history as a second normative history stream.

### Failure semantics

Application errors use stable codes and are presentation-neutral. The Phase 15 implementation must distinguish at least:

- invalid lifecycle transition;
- stale voucher version;
- approval missing/not current/not approved;
- voucher locked/not editable;
- posting validation failure;
- fiscal context no longer eligible;
- already posted/reversed or duplicate reversal condition;
- permission/actor-policy denial;
- idempotency conflict when the same request identity is reused with incompatible intent.

Persian UI maps these stable errors to user-facing messages and may show separated technical diagnostics according to Phase 14 feedback standards. UI button visibility is never transition authority.

### Actor and segregation-of-duties boundary

The lifecycle model records distinct requester/submitting, approving, posting, amendment, and reversal actors. Granular permissions are required at the Application boundary.

Whether one user may combine creator/approver/poster roles is a security-policy decision finalized in Phase 15 Step 9. The state machine does not hard-code an organization-specific segregation rule, but it preserves all actor evidence needed to enforce such a rule deterministically.

### Fiscal semantics

Draft editing continues to require the existing fiscal eligibility rules. Final posting always re-resolves/revalidates the persisted fiscal context against the voucher date and current fiscal status immediately before commit.

A voucher approved while a period is open is not guaranteed to post later if that period becomes locked or closed. Approval is not a substitute for final fiscal validation.

Reversal uses its own reversal date and must resolve an eligible fiscal context for that date. It does not silently reopen or mutate the original voucher's fiscal period.

### Presentation boundary

The desktop UI displays the persisted Journal lifecycle state and Approval/posting/reversal traceability, but does not derive legal transitions locally. Capability/action availability is supplied from Application-layer rules plus authorization context.

All touched surfaces follow the Phase 14 Persian RTL, Solar Hijri, accessibility, keyboard, feedback, and global density contracts.

### Portability and synchronization

Lifecycle state values and evidence are explicit durable data, not SQLite-specific behavior. Public Domain/Application contracts contain no React, Tauri, SQLite, PostgreSQL, HTTP, or .NET dependency.

Stable IDs, expected versions, request identities, timestamps, actor evidence, correlation/causation IDs, approval linkage, posting evidence, and reversal lineage are retained so the same transition semantics can be reproduced by a future PostgreSQL/.NET adapter and synchronized safely.

## Consequences

### Positive

- Accounting state and generic approval state have clear ownership and cannot be conflated.
- Posting remains an explicit accounting action after approval, enabling final validation and segregation of duties.
- Posted facts are preserved rather than destructively edited.
- Reversal is auditable and queryable through explicit lineage.
- Concurrency and retries have deterministic behavior.
- Existing Phase 08/09 infrastructure is reused rather than duplicated.
- The design remains portable to Argin Bridge/server deployment.

### Negative

- Cross-aggregate Journal/Approval coordination is more complex than embedding approval fields directly inside Journal Voucher.
- Reopening an approved voucher requires a new approval cycle after amendment.
- More lifecycle metadata, indexes, audit records, and idempotency evidence must be persisted.
- Reversal creates additional vouchers instead of simplifying history through mutable balances.

### Risks

- Separate Journal and Approval repositories can drift if Step 11 fails to provide one atomic coordination boundary for joint transitions.
- Incorrect idempotency scoping could still duplicate posting/reversal side effects.
- A future configurable approval policy could introduce contradictory shortcuts if it bypasses this ADR rather than extending the explicit precondition model.
- UI capability projections can become stale; commands must therefore always revalidate authoritative state and version.

## Alternatives Considered

- **Embed the Approval state machine inside `JournalVoucher`: rejected.** It duplicates Phase 08 and couples accounting to approval implementation details.
- **Treat `approved` as automatically `posted`: rejected.** Approval and final accounting posting have different permissions, validation timing, and audit meaning.
- **Allow direct `draft -> posted`: rejected for Phase 15 manual journals.** The controlled lifecycle requires approval evidence before posting.
- **Keep Journal state only as `draft/posted` and infer approval from Approval Request: rejected.** Locking, UI capability, synchronization, and stale-state protection require explicit accounting lifecycle state.
- **Edit posted vouchers in place: rejected.** It destroys the historical accounting fact and weakens auditability.
- **Reverse by changing original debit/credit values or marking the voucher ignored: rejected.** Accounting correction must remain additive and traceable.
- **Reuse an old approval after content amendment: rejected.** Approval must correspond to the exact content/version being posted.
- **Publish lifecycle events before commit: rejected.** Consumers must never observe an accounting transition that later rolls back.
- **Use SQLite-specific triggers as the lifecycle engine: rejected.** Business semantics must remain portable and testable in Domain/Application code.

## Implementation Notes

- Step 3 implements the Journal lifecycle state/value model and transition invariants selected here.
- Step 4 integrates Phase 08 Approval contracts and establishes atomic coordination behavior.
- Step 5 implements final posting revalidation and immutable posted evidence.
- Step 6 implements controlled amendment/reopen behavior.
- Step 7 implements reversal/replacement lineage.
- Step 8 exposes persistence-neutral lifecycle commands/queries and stable errors.
- Step 9 finalizes granular permissions and any organization-level segregation-of-duties rule.
- Step 10 adds versioned lifecycle persistence.
- Step 11 implements SQLite atomicity, optimistic concurrency, and durable idempotency.
- Step 12 adds audit/integration event/notification evidence.
- Steps 13–14 expose the lifecycle through the canonical desktop presentation architecture.

## Related Documents

- [Phase 15 — Fixed Implementation Plan](../phases/phase-15-journal-lifecycle-plan.md)
- [Phase 15 — Implementation Record](../phases/phase-15-journal-lifecycle.md)
- [ADR-0013 — Journal Voucher Engine Architecture](ADR-0013-journal-voucher-engine.md)
- [ADR-0008 — Approval Workflow with Optimistic Concurrency](ADR-0008-approval-optimistic-concurrency.md)
- [ADR-0007 — Immutable Audit Trail](ADR-0007-immutable-audit-trail.md)
- [ADR-0005 — Repository and Unit of Work](ADR-0005-repository-unit-of-work.md)
- [ADR-0009 — Shared Platform Infrastructure Before Accounting Core](ADR-0009-platform-infrastructure-first.md)
- [ADR-0014 — UI Foundation and Global Display Density](ADR-0014-ui-foundation-and-global-density.md)
- [Accounting Engine](../accounting/accounting-engine.md)
- [Phase 08 — Audit Trail and Approval Workflow](../phases/phase-08-audit-approval.md)
