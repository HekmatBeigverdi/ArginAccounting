# Domain Glossary

This glossary defines canonical English repository terms and their Persian UI meaning. New modules must extend it instead of inventing conflicting terminology.

| English term | Persian UI term | Definition |
|---|---|---|
| Company | شرکت | Legal or operational accounting entity. |
| Branch | شعبه | Organizational subdivision within a company. |
| Fiscal Year | سال مالی | Accounting year containing fiscal periods. |
| Fiscal Period | دوره مالی | Controlled posting interval inside a fiscal year. |
| Chart of Accounts | کدینگ حساب‌ها | Hierarchical catalogue of accounting accounts. |
| Account | حساب | Classification used on journal lines. |
| Journal Voucher | سند حسابداری | Balanced accounting document containing journal lines. |
| Journal Line | آرتیکل سند | Debit or credit entry within a voucher. |
| Debit | بدهکار | Debit side of a journal entry. |
| Credit | بستانکار | Credit side of a journal entry. |
| Dimension Type | نوع بُعد حسابداری | Reusable analytical axis such as party, project, or cost centre. |
| Dimension Member | عضو بُعد حسابداری / تفصیلی | Selectable value within one dimension type. |
| Account-Dimension Policy | سیاست حساب و بُعد | Required, optional, or forbidden dimension rule for an account. |
| Posting | ثبت حسابداری | Conversion of an approved source transaction into accounting entries. |
| Posting Rule | قاعده ثبت | Versioned rule that maps source data to accounting entries. |
| Approval Request | درخواست تأیید | Workflow request requiring an authorized decision. |
| Audit Entry | رویداد حسابرسی | Immutable evidence of an operation and its context. |
| Money | مبلغ پولی | Amount paired with currency and precision rules. |
| Number Series | سری شماره‌گذاری | Concurrency-safe document-number generator. |
| Optimistic Concurrency | همزمانی خوش‌بینانه | Version-based prevention of lost updates. |
| Source Document | سند مبدأ | Business document that may generate accounting entries. |
| Reversal | سند برگشتی | Explicit accounting operation that neutralizes a prior posting. |
