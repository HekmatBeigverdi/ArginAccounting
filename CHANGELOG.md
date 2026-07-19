# Changelog

All notable changes to this project will be documented here.

---

## [0.6.0] - Unreleased

### Added

- Fiscal year domain
- Fiscal period domain
- Current fiscal year selection
- Historical operation locks
- Shared document number series
- Operation date validation
- SQLite fiscal repositories
- Persian fiscal year setup form

### Database

- Added `fiscal_years`
- Added `fiscal_periods`
- Added `historical_locks`
- Added `number_series`

### Architecture

- Business dates remain Gregorian in storage
- Jalali remains the presentation calendar
- Document numbering is shared across modules
- Period and historical locking are independent
-
