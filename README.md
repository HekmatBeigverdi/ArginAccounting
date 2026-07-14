# ArginAccounting

ArginAccounting is a modular, offline-first, Persian accounting platform designed for Iranian companies.

## Product Vision

The first production version is a desktop accounting application built with Next.js, React, TypeScript, Tauri, and SQLite.

The architecture must support future migration to:

- ASP.NET Core Web API
- PostgreSQL
- Web application
- Multi-user deployment
- Hybrid offline and online operation
- Synchronization between SQLite and PostgreSQL

## Product Language and Localization

- Application language: Persian
- Layout direction: RTL
- Primary calendar: Solar Hijri / Jalali
- Primary currency: Iranian Rial
- Optional display currency: Toman
- Source code language: English
- Database identifiers: English
- API contracts: English
- GitHub documentation: English
- Commit messages: English

## Accounting Model

ArginAccounting follows Iranian accounting practices while using a modern modular architecture.

The accounting core supports:

- Hierarchical chart of accounts
- Floating detail accounts
- Accounting dimensions
- Journal vouchers
- Debit and credit controls
- Fiscal years and periods
- Document approval
- Final posting
- Reverse posting
- Audit trail
- Automatic posting rules
- Drill-down reporting

## Main Modules

- Company and Branch
- Fiscal Management
- Security
- Accounting
- Master Data
- Inventory
- Purchases
- Sales
- Treasury
- Fixed Assets
- Depreciation
- Payroll
- Human Resources
- Manufacturing
- Cost Accounting
- Budgeting
- Contracts and Projects
- Reporting
- Iranian Taxpayer System Integration
- Synchronization

## Architecture Principles

- Modular
- Offline-first
- Desktop-first
- Web-ready
- Database-independent domain
- UI-independent business logic
- Immutable posted documents
- Event-driven integration
- Auditability
- Testability

## Branch Strategy

- `main`: stable releases
- `develop`: integration branch
- `phase/*`: phase development branches
- `fix/*`: bug fixes
- `release/*`: release preparation

## Current Phase

Phase 01 - Repository and Architecture Baseline
