# Domain Glossary

This glossary defines canonical English repository terms and their Persian UI meaning. New modules must extend it instead of inventing conflicting terminology.

| English term | Persian UI term | Definition |
|---|---|---|
| Company | شرکت | Legal or operational accounting entity. |
| Branch | شعبه | Organizational subdivision within a company. |
| Fiscal Year | سال مالی | Accounting year containing fiscal periods. |
| Fiscal Period | دوره مالی | Controlled accounting interval inside a fiscal year. |
| Chart of Accounts | کدینگ حساب‌ها | Hierarchical catalogue of accounting accounts. |
| Account | حساب | Classification referenced by journal lines. Posting requires an eligible posting-enabled account. |
| Journal Voucher | سند حسابداری | Balanced accounting aggregate containing ordered journal lines and their accounting-dimension assignments. |
| Draft Journal Voucher | سند حسابداری پیش‌نویس | Editable Journal Voucher before final posting. |
| Journal Line | آرتیکل سند | Ordered debit or credit entry within one Journal Voucher. |
| Debit | بدهکار | Debit side of a journal entry. |
| Credit | بستانکار | Credit side of a journal entry. |
| Dimension Type | نوع بُعد حسابداری | Reusable analytical axis such as party, project, cost centre, contract, or department. |
| Dimension Member | عضو بُعد حسابداری / تفصیلی | Selectable value within one dimension type. |
| Account-Dimension Policy | سیاست حساب و بُعد | Required, optional, or forbidden dimension rule for an account. |
| Journal Dimension Assignment | تخصیص بُعد آرتیکل | Stable reference from one journal line to one or more members of a permitted dimension type. |
| Voucher Number | شماره سند | System-generated Journal Voucher business number allocated from the scoped Number Series. |
| Voucher Reference | شماره مرجع | Optional external/manual reference distinct from the generated voucher number. |
| Request ID | شناسه درخواست | Durable idempotency key used to replay a committed create request without duplicating the voucher. |
| Optimistic Version | نسخه همزمانی | Monotonically increasing aggregate version used to reject stale update/delete requests. |
| Posting | ثبت نهایی حسابداری | Controlled Phase 15 lifecycle transition that gives a Journal Voucher final accounting effect. |
| Posting Rule | قاعده ثبت | Versioned rule that maps source data to accounting entries. |
| Approval Request | درخواست تأیید | Workflow request requiring an authorized decision. |
| Audit Entry | رویداد حسابرسی | Immutable evidence of an operation and its context. |
| Money | مبلغ پولی | Amount paired with currency and precision rules. |
| Number Series | سری شماره‌گذاری | Concurrency-safe document-number generator scoped by business context. |
| Optimistic Concurrency | همزمانی خوش‌بینانه | Version-based prevention of lost updates. |
| Source Document | سند مبدأ | Business document that may generate accounting entries. |
| Reversal | سند برگشتی | Separate inverse posted Journal Voucher that neutralizes a prior posting while preserving append-only history. |
| Accounting Report Query | فیلتر/درخواست گزارش حسابداری | Normalized persistence-neutral report context containing Company, Branch, period, account, dimension, currency, sorting, paging, and traceability scope. |
| Opening Balance | مانده اول دوره | Net eligible posted accounting effect before the report `fromDate`. |
| Period Turnover | گردش دوره | Debit and credit movement inside the inclusive report date range. |
| Ending Balance | مانده پایان دوره | Opening balance plus period debit minus period credit. |
| Trial Balance | تراز آزمایشی | Account balance/turnover projection whose totals are calculated from posting accounts without hierarchy double counting. |
| General Ledger | دفتر کل | Ordered account movement report with opening and running balance plus Journal trace identity. |
| Subsidiary Ledger | دفتر معین | Detailed posting-account movement/turnover report derived from canonical ledger semantics. |
| Journal Report | دفتر روزنامه | Chronological report of posted Journal Line facts with account, dimension, debit/credit, and source traceability. |
| Accounting Dimension Report | گزارش ابعاد حسابداری | Canonical posted-fact aggregation by Dimension Member or Account × Dimension Member. |
| Report Trace Identity | شناسه رهگیری گزارش | Durable Voucher ID + Journal Line ID used to navigate from a report row to its accounting source. |
| Product/Service Master | کالا / خدمت | Canonical company-scoped Master Data record describing a product or service independently of stock, price, purchasing, selling, posting, or synchronization workflow. |
| Product ID | شناسه پایدار کالا/خدمت | Durable cross-store identity used by downstream modules. Display code, title, SKU, barcode, and official identifiers are not foreign identity. |
| Product Code | کد کالا/خدمت | Human-readable company-scoped display code; mutable business identity metadata rather than durable entity identity. |
| Product Capability | قابلیت کالا/خدمت | Master-data eligibility such as purchasable or sellable; it does not implement Purchase or Sales workflow behavior. |
| Unit of Measure | واحد اندازه‌گیری | Product-specific base or alternate unit with deterministic ratio, precision, and rounding semantics. |
| Taxpayer Unit Code | کد واحد سامانه مودیان | Official external measurement-unit reference mapped to a Product unit and kept separate from Argin unit identity. |
| Taxpayer Goods/Service ID | شناسه کالا/خدمت مودیان | Official 13-digit Iranian Taxpayer System goods/service identifier stored as Product master metadata. |
| Product Selector | انتخابگر کالا/خدمت | Bounded persistence-neutral lookup contract that returns durable Product ID plus display metadata for future ERP consumers. |
| Product Tombstone | نشان حذف همگام‌سازی کالا/خدمت | Deletion/change-propagation metadata reserved for synchronization; distinct from ordinary active/inactive business status. |
