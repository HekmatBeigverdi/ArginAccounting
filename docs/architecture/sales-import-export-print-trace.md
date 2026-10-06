# Sales Import, Export, Print/PDF and Operational Trace

## Scope

Phase 24 Step 28 adds operational transfer and trace surfaces without changing Sales, Inventory, Valuation or Accounting ownership.

## Draft-only import

Sales import accepts XLSX/CSV tabular data and supports only Sales Invoice and Sales Order creation. Every imported document is created as Draft through the same validated Sales draft Application path used by interactive entry.

Required columns:

| Persian header | Meaning |
| --- | --- |
| کلید سند | Stable file-local document key; repeated rows form one document |
| نوع سند | فاکتور فروش or سفارش فروش |
| تاریخ | Canonical Gregorian business date in YYYY-MM-DD |
| کد مشتری | Active Party customer code |
| شرح سند | Optional description |
| کد کالا | Active sellable Product/Service code |
| تعداد | Positive quantity |
| قیمت واحد | Non-negative Rial-oriented unit selling price |
| تخفیف درصد | Percentage, converted to basis points |
| مالیات درصد | Percentage, converted to basis points |

Import first builds a complete preview. Any invalid document blocks commit. Customer/Product references are resolved to durable IDs before creation. The file hash plus document key forms a deterministic submission identity (`sales-import:<sha256>:<document-key>`), so retrying the same committed document replays rather than duplicates it.

Import never submits, approves, finalizes, stages Inventory, changes stock, or posts Accounting. Return/Correction import is intentionally rejected because those documents require explicit finalized-invoice and source-line lineage.

Both `sales.documents.import` and `sales.documents.create` are required. Each imported Draft goes through normal Sales validation, idempotency and Audit.

## Excel export and Print/PDF

The selected Sales document can be exported to XLSX or rendered through the full-screen Persian RTL print preview. Output is derived from the persisted Sales commercial facts and deterministic totals; it does not re-resolve Price Lists.

The print model includes Company, Branch, document number/date/type/status, Customer, description, lines, quantity, unit selling price, discount, tax and Grand Total. A4 landscape orientation is explicit and numeric cells are isolated LTR.

`sales.reports.export` gates both Excel and Print/PDF surfaces.

## Operational trace

`SqliteSalesOperationalTraceReader` follows durable source identity:

```text
Sales Document
  -> Inventory Document staged from source_system=sales
  -> Inventory Stock Movement after Inventory confirmation
  -> Inventory Valuation Entry (FIFO/MWA)
```

The trace reports absence explicitly: a finalized Sales Invoice may have an Inventory Issue Draft but no stock movement yet; an unconfirmed movement cannot be fabricated; a confirmed movement may temporarily have unresolved valuation.

`sales.trace.view` gates the trace UI.

## Accounting boundary

Step 28 stops at authoritative Inventory Valuation. It does not query or fabricate Journal Vouchers. Phase 25 extends this chain from resolved valuation and Sales commercial facts to Revenue/VAT/Receivable and COGS/Inventory Relief posting.

## Argin Bridge

Import preserves local durable Sales identities and the existing mutation/idempotency model. Export is presentation only. Operational trace reads authoritative local facts and does not introduce a second synchronization identity.
