# ADR-001: Date Storage Strategy

## Status

Accepted

## Decision

Business dates are stored as Gregorian dates.

System timestamps are stored in UTC.

The user interface displays dates in Jalali format.

## Business Dates

Examples:

- Invoice date
- Journal date
- Cheque due date
- Fiscal year start
- Fiscal year end

Storage format:

YYYY-MM-DD

## System Timestamps

Examples:

- Created at
- Updated at
- Approved at
- Sent at
- Synced at

Storage format:

UTC ISO 8601

## Rationale

This approach provides:

- Correct sorting
- Date range filtering
- SQLite compatibility
- PostgreSQL compatibility
- .NET compatibility
- JavaScript compatibility
- API interoperability
- Reliable time zone handling
