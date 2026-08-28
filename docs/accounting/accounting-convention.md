# ArginAccounting Accounting Convention

## Monetary Model

- Iranian Rial is the canonical storage and accounting unit.
- Toman is presentation-only unless a contract explicitly states otherwise.
- Monetary values use integer or exact decimal representations; floating point is prohibited.
- Currency, scale, rounding mode, and exchange-rate source must be explicit.

## Dates

- Jalali dates are used for Persian user input and presentation.
- Business dates are persisted in Gregorian form.
- System timestamps are persisted in UTC.

## Double Entry

- Every posted journal voucher must balance total debit and total credit.
- Posting eligibility, account nature, dimensions, fiscal scope, branch scope, and period status must be validated before posting.
- Posted records are immutable; corrections use reversal, correction, or controlled replacement workflows.

## Reporting Semantics

- Persisted posted Journal Lines are the canonical accounting-report source of truth.
- Draft, pending-approval, and approved-but-unposted vouchers never affect final accounting reports.
- A reversed original remains a historical posted accounting fact; the separate posted inverse voucher neutralizes it. Reports preserve both movements and derive the net effect rather than deleting history.
- Report periods are inclusive: `fromDate <= voucherDate <= toDate`.
- Opening balance includes eligible facts before `fromDate`; period debit/credit includes the selected range; ending balance equals opening plus period debit minus period credit.
- A selected Fiscal Period constrains period movement but does not erase eligible prior-period opening facts in the selected Fiscal Year.
- Account hierarchy is defined by explicit parent/child relationships, never by code-prefix inference.
- Hierarchy totals must not double count posting descendants.
- Company, currency, fiscal, branch, account, and dimension scope are explicit. Selecting one branch excludes branchless and other-branch facts.
- Reporting and export adapters reuse canonical Application results and do not recalculate accounting balances in React, Tauri, Excel, or PDF layers.
- Multi-member dimensions have no weighted allocation semantic in Phase 16. Grouped member values must not be summed as a ledger-reconciling allocation unless a future explicit accounting policy defines allocation weights.

## Source Integrity

- Operational modules do not construct arbitrary journal entries.
- Accounting effects pass through the central posting engine.
- Journal lines retain source-document identity, posting-rule identity, correlation identity, and reversal linkage.
- Reprocessing must be idempotent.

## Iranian Requirements

The model must support Persian terminology, Iranian fiscal practice, statutory reports, tax identifiers, and Iranian Taxpayer System integration without contaminating core accounting source tables with transport-specific payloads.
