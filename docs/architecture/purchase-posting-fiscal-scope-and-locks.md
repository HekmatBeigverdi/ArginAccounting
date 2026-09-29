# Fiscal Scope and Period Locks

## Status

Phase 23 Step 18.

Step 18 prevents Purchase Posting and Purchase Posting Reversal from entering Accounting when the target fiscal scope is not currently writable.

## One Fiscal Authority

Phase 23 does not create a second fiscal calendar or lock model.

It consumes the same fiscal semantics already used by Accounting and Fiscal:

- Fiscal Year status;
- Fiscal Period status;
- fiscal date ranges;
- Historical Locks.

## Posting Gate

Before a new Accounting Draft Journal is persisted, the target context must satisfy:

```text
Company matches
Fiscal Year matches Journal
Fiscal Period matches Journal
Fiscal Year status = open
Fiscal Period status = open
Journal date inside Fiscal Year range
Journal date inside Fiscal Period range
No blocking Historical Lock
```

The gate is executed inside the same Unit of Work as the Posting write.

## Blocking Historical Locks

Purchase Posting checks active locks for:

- `all`
- `accounting`
- `purchases`

A lock blocks the operation when:

```text
operationDate <= lockedThroughDate
```

This means a globally locked date, an Accounting lock or a Purchases lock can independently block Purchase Posting.

## Locked and Closed Periods

Both:

```text
fiscalPeriodStatus = locked
fiscalPeriodStatus = closed
```

are non-writable.

A Fiscal Year in `draft`, `closing` or `closed` is also non-writable; only `open` is accepted.

## Reversal Date

A reversal is validated against the fiscal context resolved for the **reversal date**, not against the original Journal period.

This permits a valid compensating reversal in a later open period while preserving the original posted period unchanged.

For reversal, Fiscal Year/Period IDs are resolved from `reversalDate`; for new posting they must also match the IDs captured on the Draft Journal.

## Replay

Exact Step 15 replay is checked before the first-execution fiscal gate.

An already committed exact replay returns its historical committed result even if the fiscal period was subsequently locked or closed.

This preserves deterministic replay without allowing a new write into a closed period.

## Error Codes

- `fiscal_context_missing`
- `fiscal_scope_mismatch`
- `fiscal_year_not_open`
- `fiscal_period_not_open`
- `fiscal_date_out_of_range`
- `historical_lock_blocked`

## Integration Points

The gate is wired into:

- `commitPurchasePostingJournalDraftAtomically`
- `commitPurchasePostingReplaySafe`
- `reversePurchasePostingControlled`

## Argin Bridge

Fiscal IDs and operation dates are durable business identities. The future Bridge/server implementation must enforce equivalent fiscal lock semantics and must not rely on SQLite row IDs.

## Non-Scope

- Branch/accounting dimensions — Step 19;
- SQLite Fiscal adapters and Purchase Posting repositories — Steps 20–21;
- Bridge transport — Step 22.
