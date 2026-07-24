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

## Source Integrity

- Operational modules do not construct arbitrary journal entries.
- Accounting effects pass through the central posting engine.
- Journal lines retain source-document identity, posting-rule identity, correlation identity, and reversal linkage.
- Reprocessing must be idempotent.

## Iranian Requirements

The model must support Persian terminology, Iranian fiscal practice, statutory reports, tax identifiers, and Iranian Taxpayer System integration without contaminating core accounting source tables with transport-specific payloads.
