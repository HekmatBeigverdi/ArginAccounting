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
- Inventory — [Inventory Documents Module](inventory-documents.md): Phase 20 implements `@argin/inventory`, `@argin/inventory-tauri`, and Desktop quantity workflows for receipt, issue, opening, transfer, and adjustment documents; append-only movement history; rebuildable on-hand projections; quantity Kardex; Warehouse dependency guards; import/export/print; secured lifecycle; and persistence-neutral ERP/Argin Bridge contracts. Monetary valuation remains Phase 21.
- Purchases — Phase 22 implements `@argin/purchase`, `@argin/purchase-tauri`, and the Persian RTL Desktop Purchase workspace. Purchase owns Supplier commercial facts, receipt/invoice matching and Purchase-backed valuation Cost Input; it consumes Inventory public contracts and never writes Inventory quantity tables directly. Purchase accounting posting remains Phase 23.
- Sales — future commercial workflow owner; consumes Inventory public quantity-confirmation contracts instead of writing Inventory tables.
- Treasury

## Extended Modules

- Fixed Assets
- Depreciation
- Payroll
- Human Resources
- Manufacturing — future Inventory contract consumer; does not own Inventory persistence.
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
- Synchronization / Argin Bridge
- External APIs

## Module Rule

A module must not directly modify another module's internal tables.

Cross-module operations must use:

- Application services
- Public ports/contracts
- Domain events
- Posting requests
- Durable document/source links
