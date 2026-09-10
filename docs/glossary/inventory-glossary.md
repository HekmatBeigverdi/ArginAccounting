# Inventory Glossary

Canonical Phase 20 terminology. These definitions supplement the shared [Domain Glossary](domain-glossary.md) and must be used consistently by Desktop, APIs, reports and future Argin Bridge implementations.

| English term | Persian UI term | Definition |
|---|---|---|
| Inventory Document | سند انبار | Company-owned quantity document with durable identity and controlled lifecycle. |
| Inventory Receipt | رسید انبار | Incoming quantity document whose stock effect starts only after authorized confirmation. |
| Inventory Issue | حواله انبار | Outgoing quantity document, distinct from a Sales invoice. |
| Inventory Opening Document | موجودی اول دوره | Initial quantity document for one fiscal context, distinct from accounting opening balance. |
| Inventory Transfer | انتقال بین انبارها | Atomic pair/group of source and destination quantity effects sharing one durable transfer identity. |
| Inventory Adjustment | اصلاح مقدار | Reasoned signed quantity correction; it is not monetary revaluation. |
| Inventory Confirmation | قطعی‌کردن | Authorized lifecycle action that creates immutable stock effects after shared Approval. |
| Inventory Reversal | برگشت سند انبار | Linked compensating operation that neutralizes confirmed quantity facts without modifying/deleting them. |
| Stock Key | کلید موجودی | Durable Company + Product + Warehouse + optional Zone/Location quantity identity. |
| On-hand Quantity | موجودی واقعی | Quantity represented by accepted immutable movement facts. It is not reserved/available-to-promise stock. |
| Stock Movement | گردش موجودی | Immutable signed base-unit quantity fact linked to durable document and line identity. |
| Compensation Movement | گردش جبرانی | Immutable reversal fact referencing one original movement. |
| Stock Balance Projection | مانده موجودی | Rebuildable current projection derived from the movement ledger; never the sole source of truth. |
| Quantity Kardex | کاردکس تعدادی | Chronological movement report with opening, incoming, outgoing, running and closing quantities plus source drill-down. |
| Kardex Cursor | نشانگر ادامه کاردکس | Stable pagination cursor containing the full business chronology tuple, not a row offset. |
| Inventory Business Date | تاریخ عملیاتی | Gregorian internal business date displayed/entered as Jalali at the Persian UI boundary. |
| Inventory Business Order | ترتیب عملیاتی روز | Durable same-date ordering value allocated inside the Inventory UoW. |
| Base Quantity | مقدار پایه | Exact decimal quantity expressed in the Product base unit. |
| Quantity Snapshot | تصویر تاریخی مقدار و واحد | Immutable entered/base quantity plus unit conversion metadata copied when the line is created. |
| Source Drill-down | رهگیری سند مبدأ | Navigation using durable document/line/source IDs from a report fact back to its origin. |
| Inventory Dependency Guard | کنترل وابستگی موجودی | Inventory implementation of the Warehouse dependency port that protects destructive/deactivate/move operations based on stock, open documents and immutable history. |
| Draft Import | ورود گروهی پیش‌نویس | Retry-safe import that validates before persistence and creates Draft Inventory documents only. |
| Inventory Movement Feed | خوراک گردش موجودی | Bounded ordered immutable movement contract consumed by Phase 21 valuation and future ERP processes. |
| Inventory Idempotency Key | کلید تکرارپذیری عملیات انبار | Company-scoped request identity that returns the prior durable result instead of creating duplicate stock effects after retries/restart. |
| Argin Bridge Inventory Envelope | بسته همگام‌سازی موجودی پل آرگین | Versioned durable document/movement synchronization contract; derived balances are not independent authoritative payloads. |

## Canonical Chronology

Quantity chronology is always:

`businessDate -> businessOrder -> documentId -> lineId -> movementId`

Arrival time, SQLite row order, UUID lexical order and display document number are not substitutes.

## Unit and Valuation Boundary

All Phase 20 reports aggregate in Product base quantity with exact decimal strings. FIFO, moving average, cost layers and monetary Kardex/valuation are owned by Phase 21 and must not rewrite Phase 20 quantity history.
