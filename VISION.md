# ArginAccounting Vision

## Purpose

ArginAccounting is a modern, modular, offline-first accounting platform designed specifically for Iranian companies and accounting professionals.

The project aims to combine proven Iranian accounting practices with modern software architecture, a Persian user experience, strong auditability, and long-term extensibility.

ArginAccounting is not intended to be a direct copy of any existing accounting product.

It uses established systems such as Sepidar and Tadbir as functional and accounting references, while introducing a more modular, maintainable, testable, and future-ready architecture.

---

## Product Vision

ArginAccounting will initially be delivered as a Persian desktop accounting application that operates fully offline.

The initial desktop platform will use:

- Next.js
- React
- TypeScript
- Tauri
- SQLite

The architecture must support future expansion to:

- ASP.NET Core Web API
- PostgreSQL
- Multi-user operation
- Web application
- Hybrid offline and online operation
- Cloud synchronization
- Multi-branch deployment
- External integrations

The accounting core must not require a redesign when these runtime and deployment models are introduced.

---

## Target Users

ArginAccounting is designed for:

- Iranian accountants
- Financial managers
- Small and medium-sized companies
- Trading companies
- Service companies
- Manufacturing companies
- Contractors and project-based companies
- Multi-branch organizations
- Businesses requiring Iranian Taxpayer System integration

The user experience must reflect the terminology, workflows, expectations, and operational habits of Iranian accountants.

---

## Core Product Characteristics

ArginAccounting must be:

- Persian-first
- RTL-first
- Rial-based
- Jalali-calendar friendly
- Offline-first
- Desktop-first
- Web-ready
- Modular
- Auditable
- Secure
- Testable
- Extensible
- Database-independent at the domain level
- Independent from user interface technology
- Suitable for Iranian accounting requirements

---

## Accounting Foundation

The accounting core is the most important part of the platform.

All operational modules must integrate with the accounting core through explicit contracts and posting rules.

The accounting foundation must support:

- Hierarchical chart of accounts
- Iranian account coding conventions
- Configurable account coding templates
- Account groups, general ledgers, and subsidiary ledgers
- Floating detail accounts
- Multiple accounting dimensions
- Account nature and balance control
- Journal vouchers
- Debit and credit validation
- Temporary, approved, and posted documents
- Document reversal
- Document correction
- Due-date tracking
- Reference and tracking numbers
- Fiscal years and periods
- Period locking
- Opening and closing entries
- Drill-down from reports to journal lines
- Financial statements
- Audit history
- Approval workflows
- Automatic posting rules

The system must preserve familiar Iranian accounting structures while avoiding unnecessary technical limitations inherited from older software.

---

## Chart of Accounts Vision

ArginAccounting must support the account structures commonly used by Iranian accountants.

Sepidar coding samples may be used as initial templates for:

- Service companies
- Trading companies
- Manufacturing companies
- Custom organizations

These coding templates must be configurable seed data and must never be hard-coded into the accounting engine.

The chart of accounts must support:

- Configurable hierarchy
- Configurable code length
- Configurable account levels
- Account nature
- Posting permission
- Currency support
- Revaluation support
- Due-date requirements
- Tracking requirements
- Management reporting flags
- Active and inactive accounts

---

## Accounting Dimensions Vision

Floating detail accounts must remain independent from subsidiary ledger accounts.

The system must support reusable accounting dimensions such as:

- Party
- Branch
- Project
- Cost center
- Contract
- Employee
- Salesperson
- Warehouse
- Bank account
- Asset
- Custom dimension

Each posting account must define which dimensions are:

- Required
- Optional
- Forbidden

The architecture must not be permanently limited to three detail levels.

---

## Modular Platform Vision

ArginAccounting must support the gradual addition of business modules without redesigning the accounting core.

Planned modules include:

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

Future modules may include:

- Customer Relationship Management
- Point of Sale
- Maintenance
- Import and Export
- Distribution
- Sales Commission
- Cash Flow Planning
- Consolidation
- Business Intelligence

Each module must own its domain logic and must communicate with other modules through explicit contracts.

A module must not directly modify another module's internal data.

---

## Document Integration Vision

Operational documents may generate related documents in other modules.

For example, a posted sales invoice may generate:

- Inventory stock issue
- Accounting journal voucher
- Customer receivable
- Treasury receipt allocation
- Cost of goods sold entry
- Taxpayer submission draft

Generated documents must retain a permanent relationship with their source document.

A generated document must not be edited independently when its source document is responsible for it.

Corrections must be performed through:

- Source document correction
- Cancellation
- Reversal
- Replacement document
- Explicit adjustment

---

## Posting Engine Vision

Business modules must not directly create arbitrary journal lines.

They must submit accounting effects through a centralized posting engine.

The posting engine must provide:

- Posting profiles
- Posting rules
- Default account roles
- Branch-specific overrides
- Document-specific mappings
- Validation
- Idempotency
- Atomic execution
- Source-document linkage
- Reversal support

This design must allow future modules such as payroll, fixed assets, manufacturing, and budgeting to integrate without changing the journal engine.

---

## Offline-First Vision

The desktop application must remain fully functional without an internet connection.

Offline operation must include:

- Company setup
- Chart of accounts
- Journal entry
- Parties
- Products
- Inventory
- Sales
- Purchases
- Treasury
- Reports
- Printing
- Backup and restore

Internet access must only be required for explicitly online operations such as:

- Iranian Taxpayer System submission
- Cloud synchronization
- Software update
- Remote backup
- External API integration

---

## Future Web and Hybrid Vision

The desktop application is the first runtime, not the final architectural boundary.

The future platform will support:

```text
Desktop UI
    ↓
Application Contracts
    ↓
Domain Core
    ↓
Local SQLite Infrastructure

and:

Web UI
    ↓
ASP.NET Core Web API
    ↓
Domain Core
    ↓
PostgreSQL Infrastructure



The hybrid version will support:

Local SQLite
    ↓
Synchronization Engine
    ↓
ASP.NET Core API
    ↓
PostgreSQL

The accounting domain must remain consistent across all runtimes.

Iranian Localization Vision

ArginAccounting is an Iranian and Persian accounting product.

The product must use:

Persian user interface
RTL layout
Iranian accounting terminology
Iranian Rial as the primary storage currency
Jalali calendar for user input and presentation
Iranian fiscal workflows
Iranian tax and legal requirements
Persian invoice and report formats

Technical implementation remains standardized:

Source code identifiers: English
Database identifiers: English
API contracts: English
GitHub documentation: English
Commit messages: English
Branch names: English
Date and Time Vision

The user interface must operate with the Solar Hijri calendar.

Business dates must be stored as standard Gregorian dates.

System timestamps must be stored in UTC.

Examples of business dates:

Journal date
Invoice date
Cheque due date
Fiscal year start date
Fiscal year end date

Examples of timestamps:

Created at
Updated at
Approved at
Posted at
Submitted at
Synchronized at

Jalali dates are a presentation and input concern and must not reduce database compatibility or date calculation reliability.

Money Vision

Iranian Rial is the primary accounting currency.

Monetary values must not use floating-point types.

The database must store precise Rial amounts.

Toman may be available as a user-interface display option, but it must not replace Rial as the accounting storage unit.

The architecture must support future multi-currency operations, exchange rates, and currency revaluation.

Iranian Taxpayer System Vision

Iranian Taxpayer System integration must remain separate from the accounting core.

The sales invoice is the commercial and accounting source of truth.

A separate tax submission projection must be generated from the sales invoice.

The tax integration layer is responsible for:

Tax profile configuration
Tax product and service identifiers
Buyer tax information
Tax invoice validation
Tax invoice transformation
Submission
Encryption and signing
UID storage
Reference number storage
Inquiry
Retry
Error history
Raw request and response logging

Changes to the Iranian Taxpayer System must not require changes to the accounting journal, sales invoice, or inventory architecture.

The integration service will be implemented as a separate ASP.NET Core Web API.

Audit and Compliance Vision

Every critical financial operation must be traceable.

The system must record:

User
Date and time
Device or session where applicable
Operation
Source document
Previous values
New values
Approval action
Posting action
Reversal action

Posted financial documents must not be silently modified or deleted.

The audit history must remain independent from user-interface implementation.

Security Vision

Security must be based on explicit permissions.

The system must support:

Users
Roles
Permissions
Workgroups
Branch access
Warehouse access
Module access
Document approval levels
Sensitive report permissions
Administrative privileges

Future online deployment must add centralized authentication without replacing domain-level authorization rules.

Reporting Vision

Reports must support navigation from summary to detail.

Examples:

Financial Statement
    ↓
Trial Balance
    ↓
Ledger
    ↓
Journal Voucher
    ↓
Journal Line
    ↓
Source Document


Reports must support:

Persian presentation
Jalali dates
Rial and optional Toman display
PDF export
Excel export
Printing
Filtering
Grouping
Comparative fiscal periods
Drill-down
Audit traceability


User Experience Vision

ArginAccounting must provide a modern Persian interface while respecting the working habits of professional accountants.

The interface must support:

RTL layout
Fast keyboard-based entry
Efficient accounting grids
Searchable selectors
Configurable shortcuts
Multi-tab workflows
Clear validation
Persian error messages
Consistent terminology
Responsive desktop layouts
Accessible visual design

Visual modernization must not reduce accounting entry speed.

Engineering Principles

The project must follow these engineering principles:

Domain logic outside UI components
Database-independent domain
Explicit module boundaries
Versioned database migrations
Automated tests for accounting rules
Atomic financial operations
Idempotent integrations
Optimistic concurrency where appropriate
Immutable posted documents
Structured error handling
Structured logging
Architecture Decision Records
Semantic versioning
English technical documentation
Non-Negotiable Principles

The following principles must not be violated:

The accounting core must remain independent from the UI.
The accounting core must remain independent from database technology.
Taxpayer integration must not pollute accounting tables.
Posted documents must not be edited silently.
Monetary values must not use floating-point storage.
The Persian user experience must remain a primary requirement.
Offline operation must remain a supported production mode.
New modules must integrate through contracts and posting rules.
Audit history must be preserved.
Future web development must not require rewriting the accounting domain.
Coding templates must not be hard-coded into the accounting engine.
Business operations that generate multiple records must be atomic.
Integration requests must be idempotent.
Database migrations must be versioned and repeatable.
Technical documentation must remain current.
Long-Term Goal

The long-term goal is to make ArginAccounting a complete Iranian accounting and enterprise financial platform that can operate in:

Offline desktop mode
Local network mode
Cloud mode
Web mode
Hybrid mode

The platform should eventually provide a modern alternative for Iranian companies that need:

Professional accounting
Modular business operations
Reliable offline functionality
Iranian localization
Tax compliance
Extensible architecture
Modern user experience
Long-term maintainability
Success Definition

ArginAccounting will be considered successful when:

Iranian accountants can use it naturally without adapting to foreign accounting terminology.
The desktop application works reliably without internet access.
The accounting engine supports professional and auditable financial operations.
New modules can be added without redesigning the core.
The same accounting domain can support SQLite and PostgreSQL.
The project can evolve from desktop to web and hybrid deployment.
Taxpayer System changes remain isolated from the accounting core.
Financial reports can be traced back to their original documents.
The product remains maintainable over many years of development.



