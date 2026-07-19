# Phase 06 - Fiscal Management

## Goal

Implement the fiscal year, fiscal period, historical lock, and
numbering foundations for ArginAccounting.

## Scope

- Fiscal year domain
- Fiscal period domain
- Current fiscal year selection
- Period locking
- Historical operation locking
- Shared number series
- Operation date validation
- SQLite repositories
- Fiscal database migration
- Persian fiscal year setup form

## Date Strategy

Business dates are stored as Gregorian ISO dates.

The user interface presents and accepts Jalali dates.

System timestamps are stored in UTC.

## Fiscal Year Statuses

- draft
- open
- closing
- closed

## Fiscal Period Statuses

- open
- locked
- closed

## Historical Lock

Historical locking is separate from fiscal period locking.

Locks may apply to:

- All modules
- Accounting
- Sales
- Purchases
- Inventory
- Treasury
- Fixed assets
- Payroll
- Manufacturing

## Number Series

Number series support:

- Company scope
- Optional branch scope
- Optional fiscal year scope
- Entity type
- Prefix
- Suffix
- Padding
- Reset policy
- Optimistic concurrency

## Database Tables

- fiscal_years
- fiscal_periods
- historical_locks
- number_series

## Important Rules

- Fiscal years may not overlap inside one company
- One fiscal year may be current per company
- Documents must belong to an open fiscal period
- Locked dates reject operational documents
- Number allocation is atomic
- Number series may be overridden by branch or fiscal year

## Acceptance Criteria

- Fiscal packages pass type checking
- Migration version 3 is applied
- Fiscal year can be created
- Overlapping fiscal years are rejected
- Current fiscal year is selected atomically
- Period and historical locks are queryable
- Number series reservation is concurrency-safe
- Persian fiscal setup form works
