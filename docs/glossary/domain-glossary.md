# Domain Glossary

This glossary defines canonical English repository terms and their Persian UI meaning. New modules must extend it instead of inventing conflicting terminology.

| English term | Persian UI term | Definition |
|---|---|---|
| Company | شرکت | Legal or operational accounting entity. |
| Branch | شعبه | Organizational subdivision within a company. |
| Fiscal Year | سال مالی | Accounting year containing fiscal periods. |
| Fiscal Period | دوره مالی | Controlled accounting interval inside a fiscal year. Phase 13 draft mutations require an open period. |
| Chart of Accounts | کدینگ حساب‌ها | Hierarchical catalogue of accounting accounts. |
| Account | حساب | Classification referenced by journal lines. Phase 13 requires active posting-enabled Subsidiary accounts. |
| Journal Voucher | سند حسابداری | Balanced accounting aggregate containing ordered journal lines and their accounting-dimension assignments. |
| Draft Journal Voucher | سند حسابداری پیش‌نویس | Editable Phase 13 journal voucher before Journal Lifecycle posting/approval behavior exists. |
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
| Posting | ثبت نهایی حسابداری | Controlled lifecycle transition that makes journal entries final; introduced by Phase 14, not Phase 13 Draft behavior. |
| Posting Rule | قاعده ثبت | Versioned rule that maps source data to accounting entries. |
| Approval Request | درخواست تأیید | Workflow request requiring an authorized decision. |
| Audit Entry | رویداد حسابرسی | Immutable evidence of an operation and its context. |
| Money | مبلغ پولی | Amount paired with currency and precision rules. |
| Number Series | سری شماره‌گذاری | Concurrency-safe document-number generator scoped by business context. |
| Optimistic Concurrency | همزمانی خوش‌بینانه | Version-based prevention of lost updates. |
| Source Document | سند مبدأ | Business document that may generate accounting entries. |
| Reversal | سند برگشتی | Explicit accounting operation that neutralizes a prior posting; part of later Journal Lifecycle behavior. |
