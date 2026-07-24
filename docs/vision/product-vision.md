# Product Vision

ArginAccounting is a Persian, offline-first, enterprise accounting and ERP platform for Iranian companies. It combines rigorous double-entry accounting, modular business processes, modern desktop UX, and readiness for future online synchronization.

## Product Principles

- Persian-first user experience with RTL layout
- Jalali input and presentation with Gregorian internal storage
- Iranian Rial as the primary accounting currency
- Offline operation without dependence on a remote service
- Modular architecture suitable for gradual ERP expansion
- Auditability, approvals, and segregation of duties
- Deterministic accounting and posting behaviour
- Database and runtime portability
- Integration readiness for the Iranian Taxpayer System

## Target Capabilities

Company and branch management, fiscal control, security, audit, approvals, accounting, master data, inventory, purchases, sales, treasury, fixed assets, depreciation, payroll, HR, manufacturing, cost accounting, budgeting, contracts and projects, reporting, taxpayer integration, and synchronization.

## Architectural Direction

The first runtime is React + TypeScript + Tauri + SQLite. Domain and application contracts are designed for future ASP.NET Core, PostgreSQL, web, and hybrid deployments without rewriting accounting rules.

## Non-Goals

The project will not trade correctness for rapid feature count, embed business rules in UI components, couple the domain to SQLite or Tauri, or permit modules to bypass accounting and audit contracts.

## Long-Term Measure of Success

A maintainable Iranian ERP platform whose accounting results are correct, traceable, extensible, testable, and understandable by future development teams.