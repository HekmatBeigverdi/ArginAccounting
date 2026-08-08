# Coding Template Excel Workbook Contract v1.0

## Purpose

This contract is the only supported Excel shape for importing a coding-template draft. Parsers must convert it to `CodingTemplateVersionContent`; the existing template graph validator then applies exactly the same rules used for built-in catalogs. Workbook parsing never writes operational or template data.

## File and Workbook Rules

- Format: `.xlsx`; macros and external links are unsupported.
- Contract version: `1.0`.
- Maximum file size: 5 MiB.
- Exactly five worksheets are allowed, with the case-sensitive names below.
- Row 1 contains the exact, case-sensitive column names. Data starts at row 2.
- Formulas are forbidden in every declared column, including formulas with cached values.
- Empty optional cells become `null`; empty required cells are errors.
- Persian and Arabic digits are normalized to ASCII digits. Unicode compatibility normalization, trimming, and whitespace collapsing are applied to text.
- Boolean values are the stored values `true` or `false`. Enumerations use the English tokens listed below.
- `managementTags` is a pipe-separated list, for example `cash|current_asset`.
- Every error reports worksheet, row, column name, and Excel cell address.

## Limits

| Worksheet | Maximum data rows |
|---|---:|
| `Metadata` | 1 |
| `Accounts` | 10,000 |
| `DimensionTypes` | 100 |
| `DimensionMembers` | 20,000 |
| `AccountDimensionPolicies` | 30,000 |

The workbook is limited to 5 worksheets and 32 columns per worksheet.

## `Metadata`

| Column | Type | Required | Allowed values / example |
|---|---|---:|---|
| `contractVersion` | enum | yes | `1.0` |
| `templateCode` | text | yes | `custom-service-01` |
| `persianName` | text | yes | `الگوی خدماتی سفارشی` |
| `englishName` | nullable text | no | `Custom service template` |
| `activityType` | enum | yes | `service`, `trading`, `manufacturing`, `custom` |

## `Accounts`

| Column | Type | Required | Allowed values / example |
|---|---|---:|---|
| `logicalKey` | text | yes | `assets.cash` |
| `parentLogicalKey` | nullable text | no | `assets` |
| `level` | enum | yes | `group`, `general`, `subsidiary` |
| `code` | text | yes | `110101` |
| `persianName` | text | yes | `صندوق ریالی` |
| `englishName` | nullable text | no | `Cash on hand` |
| `nature` | enum | yes | `uncontrolled`, `debit`, `credit`, `strict_debit`, `strict_credit` |
| `normalBalance` | enum | yes | `debit`, `credit` |
| `statementType` | enum | yes | `balance_sheet`, `income_statement`, `memorandum` |
| `balanceSheetSection` | nullable enum | no | `assets`, `liabilities`, `equity` |
| `incomeStatementSection` | nullable enum | no | `revenue`, `cost_of_sales`, `operating_expenses`, `non_operating`, `finance_costs`, `income_tax` |
| `cashFlowCategory` | nullable enum | no | `operating`, `investing`, `financing`, `cash_and_cash_equivalents`, `non_cash` |
| `cashEquivalent`, `receivable`, `payable` | boolean | yes | `true`, `false` |
| `managementTags` | text list | no | `cash|current_asset` |
| `postingAllowed`, `currencyEnabled`, `revaluationEnabled`, `trackingEnabled`, `dueDateEnabled`, `activeByDefault` | boolean | yes | `true`, `false` |
| `displayOrder` | non-negative integer | yes | `10` |

`parentLogicalKey` is empty only for a group. Report-classification combinations and the three-level hierarchy are checked by the shared graph validator.

## `DimensionTypes`

| Column | Type | Required | Allowed values / example |
|---|---|---:|---|
| `logicalKey` | text | yes | `cost_center` |
| `code` | text | yes | `COST_CENTER` |
| `persianName` | text | yes | `مرکز هزینه` |
| `englishName` | nullable text | no | `Cost centre` |
| `hierarchical`, `allowMultipleMembers`, `activeByDefault` | boolean | yes | `true`, `false` |
| `displayOrder` | non-negative integer | yes | `10` |

## `DimensionMembers`

| Column | Type | Required | Allowed values / example |
|---|---|---:|---|
| `logicalKey` | text | yes | `cost_center.head_office` |
| `dimensionTypeLogicalKey` | text | yes | `cost_center` |
| `parentLogicalKey` | nullable text | no | empty for a root member |
| `code` | text | yes | `HEAD_OFFICE` |
| `persianName` | text | yes | `دفتر مرکزی` |
| `englishName` | nullable text | no | `Head office` |
| `activeByDefault` | boolean | yes | `true` |
| `displayOrder` | non-negative integer | yes | `10` |

## `AccountDimensionPolicies`

| Column | Type | Required | Allowed values / example |
|---|---|---:|---|
| `accountLogicalKey` | text | yes | `expenses.office` |
| `dimensionTypeLogicalKey` | text | yes | `cost_center` |
| `requirement` | enum | yes | `required`, `optional`, `forbidden` |

Logical keys are stable cross-sheet references. Missing references, duplicate keys/codes, invalid parents, hierarchy cycles, and invalid policy combinations are rejected by the shared template validator.
