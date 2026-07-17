# Changelog

All notable changes to this project will be documented here.

---

## [0.5.0] - Unreleased

### Added

- Company domain model
- Branch domain model
- Company and branch address support
- Company taxpayer identity profile
- Transactional company setup
- SQLite company repositories
- Persian company setup form

### Database

- Added `companies`
- Added `branches`
- Added `addresses`
- Added `company_tax_profiles`

### Architecture

- Tax identity data is separated from Tax SDK configuration
- Company creation and head-office creation are atomic
