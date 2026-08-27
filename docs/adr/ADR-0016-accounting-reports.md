# ADR-0016 — Accounting Reports Architecture

- Status: Accepted
- Date: 2026-08-27
- Decision Owners: Project maintainers

## Context

Phase 13 established persisted balanced Journal Vouchers and Journal Lines. Phase 15 established the controlled Journal lifecycle, final posting, immutable posted facts, and additive reversal through a separate inverse Journal Voucher. Phase 10 provides the Chart of Accounts hierarchy, Phase 11 provides accounting dimensions and account-dimension policy, Phase 06 provides fiscal-year/period boundaries, Phase 09 provides shared query infrastructure, and Phase 14 provides the canonical Persian RTL desktop experience.

Phase 16 must introduce the first production-grade Accounting Reports layer without creating a second accounting source of truth, duplicating accounting calculations in React or SQLite-specific code, or introducing report semantics that cannot later be reused by PostgreSQL/.NET or synchronization adapters.

The reporting architecture must answer several questions before implementation: which Journal facts are reportable, how reversals affect balances, how date and fiscal boundaries work, how branch scope behaves, how parent account totals are aggregated, how opening/period/ending balances are represented, whether zero-balance rows are included, and what stable identity is carried for drill-down to accounting evidence.

## Decision

### Authoritative reporting source

The authoritative source for final accounting reports is persisted Journal Lines belonging to Journal Vouchers whose accounting facts have been finally posted.

The reportable fact predicate is based on accounting effect, not UI state labels alone:

- `draft`, `pending_approval`, and `approved` vouchers never contribute to final accounting reports.
- A normally `posted` voucher contributes its Journal Lines.
- A voucher later marked `reversed` remains an immutable historical posted fact and its original Journal Lines remain reportable.
- The corresponding reversal voucher is a separate posted Journal Voucher containing the exact inverse accounting effect and is also reportable.
- The original and reversal therefore net correctly through additive accounting facts. The reporting layer must never suppress the original voucher merely because its lifecycle status is now `reversed`.

This rule preserves the append-only accounting history selected by ADR-0015 and prevents a double reversal effect caused by both excluding the original and including its inverse.

### Accounting effect versus lifecycle presentation

Lifecycle status is useful for traceability, but report eligibility is derived from durable posting evidence/accounting effect semantics.

Adapters may optimize using the persisted authoritative lifecycle/posting fields, but Domain/Application semantics remain: final reports include posted accounting facts and exclude unposted facts.

A future source-document posting engine must ultimately project into the same posted Journal source of truth rather than bypassing this reporting model.

### Amount and sign semantics

Journal Lines retain separate non-negative debit and credit amounts. Reports do not rewrite source facts into signed amounts at persistence boundaries.

For calculation only, canonical net movement is:

```text
net = debit - credit
```

Balance presentation is derived from the sign of the net value:

- positive net => debit balance;
- negative net => credit balance;
- zero => zero balance.

Presentation DTOs may expose separate debit-balance and credit-balance columns, but canonical computation must be mathematically equivalent to the signed net model.

### Report period semantics

Every bounded accounting report has an explicit inclusive report period:

```text
fromDate <= voucherDate <= toDate
```

Dates are canonical Gregorian dates internally. Persian UI presents Solar Hijri only as a presentation concern.

The report period must resolve within the selected company and, when a fiscal-year filter is supplied, within that fiscal context. Cross-fiscal reporting may be supported only when the report query explicitly allows a date range independent of one fiscal year; it must never occur accidentally through an ambiguous filter.

Phase 16 report contracts distinguish fiscal scope from raw date range rather than inferring one silently from the other.

### Opening, period, and ending balance

For an account or report row with `fromDate` and `toDate`:

```text
openingNet = sum(reportable debit - credit where voucherDate < fromDate)
periodDebit = sum(reportable debit where fromDate <= voucherDate <= toDate)
periodCredit = sum(reportable credit where fromDate <= voucherDate <= toDate)
endingNet = openingNet + periodDebit - periodCredit
```

When a fiscal-year scope is selected, opening balance is constrained to the beginning of that fiscal scope unless a future explicit retained/prior-year opening mechanism defines otherwise. Phase 16 does not synthesize historical balances outside the selected authoritative accounting facts.

Opening balance is a derived projection. It is not persisted as a separate mutable report balance table in this phase.

### Stable ordering

Detailed reports must be deterministic. Unless a specific report defines a stricter accounting ordering, movement ordering uses stable persisted fields in this precedence:

1. voucher date;
2. voucher business number or canonical ordering field;
3. voucher identifier as a stable tie-breaker;
4. Journal Line order;
5. Journal Line identifier as final tie-breaker if needed.

Running balances use this exact canonical ordering. UI sorting that changes display order must not silently change the accounting running-balance sequence.

### Chart of Accounts hierarchy aggregation

Posting occurs only to posting-enabled Subsidiary accounts under the existing accounting rules. Parent/group account report rows are derived aggregations and are never treated as independent posted facts.

For a requested hierarchy row, the engine aggregates the distinct posting descendants exactly once. A descendant Journal Line must contribute once to each explicitly requested ancestor projection but must never be counted twice within the same aggregate row.

Implementation must avoid a naive strategy that sums both a parent's pre-aggregated total and its children again.

Hierarchy identity comes from the Phase 10 account tree, not code-prefix guessing. Account code ranges may be filters, but structural parent/child aggregation uses persisted account relationships.

### Branch semantics

Company scope is mandatory for every report.

Branch filtering follows the persisted Journal Voucher branch context:

- no branch filter => include all reportable facts in the authorized company scope;
- a specific branch filter => include facts assigned to that branch;
- branchless facts are not silently included in a specific-branch report;
- if Phase 05/13 contracts explicitly model a branchless/central scope, it must be requested explicitly when needed.

Authorization is evaluated before data is returned. A caller cannot use reporting filters to infer cross-company or unauthorized-branch data.

Phase 16 does not invent allocation of one Journal Line across multiple branches. Branch reporting follows the voucher's persisted branch scope.

### Fiscal semantics

Fiscal status controls mutation/posting eligibility at posting time, not later read visibility.

Closing or locking a fiscal period does not remove its posted facts from reports. Historical posted facts remain reportable after the period is closed.

Fiscal-year and fiscal-period filters are read scopes. They must resolve by persisted fiscal identities/date boundaries and company ownership, not by current `open/closed` mutation eligibility.

### Reversal semantics

A reversal is accounted for by including both immutable posted sides of the accounting history:

```text
original posted voucher    +100 debit
reversal posted voucher    -100 net effect through inverse debit/credit
-------------------------------------------------------------
net accounting effect         0
```

The original voucher remains visible in detailed traceability. Reports may display reversal lineage/status metadata but must not mutate or omit source facts to force a zero result.

Replacement/correcting vouchers, when present, are independent posted facts and contribute according to their own Journal Lines.

### Zero-balance policy

Zero-balance inclusion is an explicit query option and never an adapter-specific default.

The default for interactive accounting reports is to omit rows that have zero opening balance, zero period debit, zero period credit, and zero ending balance.

When `includeZeroBalances` is enabled, eligible accounts in the requested account/hierarchy scope may be returned even when all four measures are zero. Structural parent rows may still be included when required to present a requested hierarchy coherently, provided this behavior is explicit in the report projection contract.

Accounts with zero ending balance but non-zero period turnover are not considered zero-activity rows and must not be omitted by the zero-balance filter.

### Trial Balance column semantics

The canonical balance engine exposes opening debit/credit, period debit/credit, and ending debit/credit projections.

Phase 16 can derive common Trial Balance presentations from these measures rather than building separate calculation engines for two-, four-, six-, or eight-column views. Column variants are presentation/projection choices over one canonical calculation model.

The exact UI variants delivered in Step 5 must therefore map to the same underlying measures and reconciliation totals.

### Ledger and running-balance semantics

General Ledger and Subsidiary/Account Ledger use the same reportable Journal facts and period semantics as Trial Balance.

For a detailed account ledger:

- opening balance is computed before `fromDate` within the selected scope;
- period movements are ordered deterministically;
- each row carries debit, credit, and resulting running net balance;
- running balance begins from opening net and applies each row as `+debit - credit`.

The ledger must reconcile to the ending balance from the canonical balance engine for the same query scope.

### Accounting dimension semantics

Dimension reporting uses persisted Journal Line dimension assignments from Phase 11.

Dimensions are filters/grouping axes over the same posted Journal facts; they do not create an independent balance store. Required/optional/forbidden assignment policy is a posting-time invariant and is not reinterpreted differently by reports.

Dimension types remain data/configuration driven. Phase 16 must not hard-code only cost center/project if the Phase 11 model supports general dimension types.

When grouping by one dimension, lines without an assignment to that dimension are handled through an explicit unassigned policy in the query/projection contract rather than being silently redistributed.

### Drill-down and traceability identity

Every aggregate report result that supports drill-down must preserve enough stable context to reconstruct the exact underlying query, including at minimum:

- company ID;
- branch scope/filter when applicable;
- fiscal/date scope;
- account ID or account hierarchy node ID;
- dimension filters/group key when applicable.

Detailed movement rows additionally carry stable source identifiers:

- Journal Voucher ID;
- Journal Line ID;
- voucher business number;
- voucher date;
- reversal/original lineage identifiers when relevant and available.

Navigation never relies on description text, array position, or formatted Persian values as identity.

### Query/application boundary

Report semantics live in Domain/Application contracts and pure calculation/projection logic.

The Application boundary owns:

- query validation;
- company/branch authorization scope;
- fiscal/date/filter normalization;
- canonical report semantics;
- stable errors;
- pagination/sorting contracts;
- traceability context.

SQLite owns efficient retrieval, aggregation, indexes, and query plans but may not define different accounting rules.

React/Tauri presentation code owns formatting, interaction, Persian RTL presentation, density, print preview, and navigation but may not calculate authoritative balances independently.

### Performance architecture

Phase 16 does not create a mutable reporting snapshot or denormalized balance ledger as the source of truth.

SQLite adapters should prefer set-based filtering, projection, aggregation, and pagination. Required indexes are introduced only after actual query shapes are defined and justified in Step 11/17.

Loading the entire Journal into application memory for routine reports is rejected.

If future scale requires materialized balances, they must be treated as reproducible projections with reconciliation to posted Journal facts and require a separate architecture decision.

### Export and print semantics

Print/PDF/Excel adapters consume canonical report DTOs/results. They do not rerun independent accounting formulas.

Export formatting may differ from interactive UI, but totals, row identities, filters, and accounting meaning must match the canonical report query result.

### Currency boundary

Phase 16 reports preserve the existing explicit currency contract and Iranian Rial presentation convention. The phase does not introduce realized FX gain/loss, translation, remeasurement, or multi-currency consolidation logic.

Reports must not sum economically incompatible currencies into one numeric total unless the query contract has a single canonical currency or a future conversion policy explicitly provides that behavior.

## Consequences

### Positive

- Journal remains the single accounting source of truth.
- Reversal accounting is naturally correct and auditable without destructive filtering.
- Trial Balance, Ledger, Journal, and Dimension reports reconcile through one semantic model.
- Parent-account totals cannot accidentally double-count descendants when the hierarchy contract is followed.
- SQLite optimizations remain replaceable by future PostgreSQL/.NET adapters.
- Drill-down can deterministically reach the exact source voucher and line.
- Export/print cannot drift from interactive report calculations.

### Negative

- Opening balances are query-derived, so large historical datasets require careful indexing/aggregation.
- Deterministic hierarchy and branch semantics make report queries more explicit than ad-hoc SQL.
- Including both original and reversal vouchers means detailed reports show more rows than a destructive net-only history, which is intentional for auditability.
- A fully generic dimension model makes queries and UI more complex than hard-coding cost center/project.

### Risks

- Filtering only `lifecycle_status = 'posted'` would incorrectly exclude originals whose status becomes `reversed`; adapters must implement reportable accounting-effect semantics correctly.
- A hierarchy implementation that combines already-aggregated parent totals with descendant totals can double count.
- Branchless vouchers can be misreported if adapters silently include them in every branch.
- UI re-sorting detailed movements could display a running balance inconsistent with canonical accounting order.
- Premature materialized balance tables could become a second source of truth without strict reconciliation.
- Inconsistent date inclusivity between reports would break reconciliation; all Phase 16 reports must share the canonical inclusive period contract.

## Alternatives Considered

- **Report only vouchers whose current lifecycle status equals `posted`: rejected.** An original voucher changes to `reversed` after a valid reversal but remains an immutable posted accounting fact; excluding it while including the inverse voucher would produce the wrong net effect.
- **Exclude both original and reversal vouchers from balances after reversal: rejected.** It destroys additive accounting history and prevents faithful period/audit reporting when original and reversal occur on different dates.
- **Mutate the original voucher to zero after reversal: rejected.** ADR-0015 requires immutable posted facts and additive correction.
- **Persist mutable account balances as the Phase 16 source of truth: rejected.** Journal facts remain authoritative; derived caches/materializations require a later explicit ADR if needed.
- **Calculate balances separately inside each report: rejected.** Trial Balance, Ledger, and Dimension reports must reconcile through one canonical balance/turnover model.
- **Infer account hierarchy from code prefixes: rejected.** Phase 10 persisted parent/child relationships are authoritative.
- **Always include branchless vouchers in every branch report: rejected.** That leaks central/unassigned facts into branch totals.
- **Treat closed fiscal periods as invisible: rejected.** Fiscal closure blocks later mutation/posting, not historical reporting.
- **Hard-code cost center and project reports: rejected.** Phase 11 defines generic accounting dimensions.
- **Let SQLite SQL define business semantics independently: rejected.** Adapters optimize stable Application semantics; they do not own them.
- **Load all Journal data into React/application memory: rejected.** It is inefficient and creates duplicated calculation logic.
- **Recalculate exports independently from screen reports: rejected.** Export must consume canonical report results.

## Implementation Notes

- Step 3 defines the common persistence-neutral report period/filter/query vocabulary selected here.
- Step 4 implements the canonical opening/period/ending balance and hierarchy aggregation engine.
- Step 5 derives Trial Balance projections from that canonical engine.
- Steps 6–8 implement deterministic detailed ledger and journal projections using the same reportable-fact and period semantics.
- Step 9 adds dimension filters/grouping over the same posted Journal facts.
- Step 10 formalizes Application queries, DTOs, stable errors, paging/sorting, and traceability identities.
- Step 11 maps the architecture to optimized SQLite queries without moving accounting semantics into the adapter.
- Step 12 enforces report permissions and company/branch authorization.
- Steps 13–15 expose the same contracts through Persian RTL UI, drill-down, print, Excel, and PDF.
- Steps 16–17 prove cross-report reconciliation, reversal/date/fiscal/branch/hierarchy correctness, and practical query performance.

## Related Documents

- [Phase 16 — Fixed Implementation Plan](../phases/phase-16-accounting-reports-plan.md)
- [ADR-0015 — Journal Lifecycle Architecture](ADR-0015-journal-lifecycle.md)
- [ADR-0013 — Journal Voucher Engine Architecture](ADR-0013-journal-voucher-engine.md)
- [ADR-0014 — UI Foundation and Global Display Density](ADR-0014-ui-foundation-and-global-density.md)
- [ADR-0011 — Accounting Dimensions](ADR-0011-accounting-dimensions.md)
- [Accounting Engine](../accounting/accounting-engine.md)
- [Roadmap](../../ROADMAP.md)
