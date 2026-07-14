# ADR-002: Money Storage Strategy

## Status

Accepted

## Decision

Accounting amounts are stored in Iranian Rial.

Floating-point types must not be used for monetary values.

## Desktop Database

SQLite stores monetary values as integer Rial amounts.

## Future PostgreSQL Database

PostgreSQL stores monetary values as BIGINT or NUMERIC based on the domain requirement.

## Presentation

The UI may display:

- Rial
- Toman

Toman is presentation-only.

## Currency Code

Primary currency code:

IRR
