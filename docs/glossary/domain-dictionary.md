# Domain Dictionary

The domain dictionary is the canonical semantic catalog for entities, value objects, commands, events, statuses, identifiers, and accounting terminology.

## Required Entry Format

Each term must include:

- canonical English name;
- Persian user-facing term where applicable;
- definition and invariants;
- owning bounded context;
- related database object;
- related permissions and workflows;
- lifecycle/status values;
- prohibited ambiguous synonyms.

## Terms

| Term | Persian | Definition | Context |
|---|---|---|---|
| Company | شرکت | Legal or operational accounting owner. | Company |
| Branch | شعبه | Operational scope within a company. | Company |
| Fiscal Year | سال مالی | Accounting period container with controlled lifecycle. | Fiscal |
| Permission | مجوز | Stable application-boundary authorization capability. | Security |
| Audit Entry | رویداد حسابرسی | Immutable trace of a significant action and outcome. | Audit |
| Approval Request | درخواست تأیید | Versioned workflow request with append-only decision history. | Approval |
| Account | حساب | Stable company-scoped accounting identity whose code and name are controlled business attributes. | Accounting |
| Account Code | کد حساب | Company-unique normalized numeric code; Persian and Arabic digits normalize to English digits. | Accounting |
| Group Account | حساب گروه | Root level of the operational Chart of Accounts; never posting-enabled. | Accounting |
| General Account | حساب کل | Child of a Group account; never posting-enabled. | Accounting |
| Subsidiary Account | حساب معین | Child of a General account; may be posting-enabled. | Accounting |
| Account Coding Settings | تنظیمات کدینگ حساب‌ها | Versioned company policy for code lengths, hierarchical codes, and code changes after use. | Accounting |
| Account Usage | گردش حساب | Evidence that an account has financial or protected operational references and therefore cannot be physically deleted. | Accounting |
| Accounting Dimension Type | نوع بُعد حسابداری | Company-scoped analytical axis independent from the account tree; controls hierarchy and whether multiple members may be selected. | Accounting |
| Accounting Dimension Member | عضو بُعد حسابداری / تفصیلی | Versioned classification value belonging to one dimension type, optionally hierarchical and effective-dated. | Accounting |
| Account-Dimension Policy | سیاست حساب و بُعد | Unique rule declaring a dimension required, optional, or forbidden for a Subsidiary account. | Accounting |
| Dimension Assignment | تخصیص بُعد | Dimension type and selected member identifiers validated for an accounting line and document date. | Accounting |
| Coding Template | الگوی کدینگ | Company-independent, versioned graph of accounts, dimensions, members, and policies for service, trading, manufacturing, or custom sources. | Accounting |
| Coding Template Version | نسخه الگوی کدینگ | Immutable published template content identified by a sequential version and content fingerprint. | Accounting |
| Template Application | اعمال الگوی کدینگ | Confirmed, atomic, retry-safe provisioning of validated template items into one company with durable history and mappings. | Accounting |
| Template Upgrade | ارتقای الگوی کدینگ | Explicit non-destructive comparison and application of selected additive changes while preserving local modifications. | Accounting |
| Workbook Import Batch | نوبت ورود اکسل | Fingerprinted, contract-versioned, idempotent import attempt that creates a custom template version only after successful validation and confirmation. | Accounting |
| Journal Voucher | سند حسابداری | Balanced accounting document composed of debit and credit lines. | Accounting |
| Posting Rule | قاعده صدور سند | Deterministic mapping from source document effects to journal lines. | Posting |

Add terms during the phase that introduces them; do not defer glossary maintenance.
