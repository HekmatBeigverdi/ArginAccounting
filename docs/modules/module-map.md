# Module Map

## Foundation Modules

- Shared
- Core
- Database
- Company
- Fiscal
- Security
- Workflow
- Audit
- Numbering
- Attachments

## Accounting Modules

- Accounting
- Accounting Dimensions
- Posting Engine
- Financial Statements
- Reporting

## Operational Modules

- Master Data
- Inventory
- Purchases
- Sales
- Treasury

## Extended Modules

- Fixed Assets
- Depreciation
- Payroll
- Human Resources
- Manufacturing
- Cost Accounting
- Budgeting
- Contracts
- Projects
- CRM
- Point of Sale
- Maintenance

## Integration Modules

- Iranian Taxpayer System
- Import and Export
- Synchronization
- External APIs

## Module Rule

A module must not directly modify another module's internal tables.

Cross-module operations must use:

- Application services
- Domain events
- Posting requests
- Document links
