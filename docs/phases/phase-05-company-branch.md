# Phase 05 - Company and Branch

## Goal

Implement the company and branch domain for ArginAccounting.

## Scope

- Company domain model
- Branch domain model
- Address model
- Company tax identity profile
- Repository contracts
- Transactional company setup service
- SQLite repositories
- SQLite schema migration
- Persian desktop setup form

## Architectural Boundary

The company module owns:

- Legal company identity
- Company localization defaults
- Branches
- Company and branch addresses
- Basic taxpayer identity

The company module does not own:

- Tax SDK configuration
- Private keys
- Access tokens
- Invoice UID
- Reference numbers
- Submission requests
- Inquiry responses

Those responsibilities belong to the Tax Integration module.

## Company Defaults

- Currency: IRR
- Locale: fa-IR
- Calendar presentation: Jalali
- Initial status: active

## Transactional Setup

The initial company setup creates:

1. Company
2. Head office branch
3. Primary address
4. Optional taxpayer identity profile

All records are created in one database transaction.

## Database Tables

- companies
- branches
- addresses
- company_tax_profiles

## Important Constraints

- Company code is unique
- Branch code is unique inside a company
- Each company can have one head office
- Each company can have one tax identity profile
- Each entity can have one primary address

## Acceptance Criteria

- Company package passes type checking
- SQLite repository package passes type checking
- Migration version 2 is applied
- Company can be created from the Persian desktop UI
- Head office is created atomically
- Duplicate company code is rejected
- Invalid input displays Persian validation messages
- Tax integration credentials remain outside company tables
