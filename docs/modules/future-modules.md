# Future Modules

The architecture must support future modules without redesigning the accounting core.

## Fixed Assets

- Asset registration
- Asset categories
- Asset locations
- Asset custodians
- Acquisition
- Transfer
- Disposal
- Revaluation
- Impairment
- Depreciation

## Payroll

- Employees
- Employment contracts
- Payroll periods
- Benefits
- Deductions
- Loans
- Insurance
- Payroll tax
- Payroll settlements

## Manufacturing

- Bill of materials
- Production orders
- Material consumption
- Finished goods receipt
- Work in progress
- Waste
- Production overhead

## Cost Accounting

- Cost centers
- Cost objects
- Cost allocation
- Overhead absorption
- Standard costing
- Actual costing

## Budgeting

- Budget periods
- Budget accounts
- Budget versions
- Budget control
- Actual versus budget reporting

## Contracts and Projects

- Contracts
- Contract parties
- Project accounting
- Progress billing
- Retention
- Advances
- Project profitability

## Integration Requirement

Each future module must generate accounting impact through the posting engine.

No module may directly write journal entries without using the posting contracts.
