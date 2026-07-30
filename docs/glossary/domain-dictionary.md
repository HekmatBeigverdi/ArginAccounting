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
| Accounting Dimension | بُعد حسابداری / تفصیلی | Independent detailed classification planned for Phase 11; not a fourth account-tree level. | Accounting |
| Coding Template | الگوی کدینگ | Versioned service, trading, or manufacturing account template planned for Phase 12. | Accounting |
| Journal Voucher | سند حسابداری | Balanced accounting document composed of debit and credit lines. | Accounting |
| Posting Rule | قاعده صدور سند | Deterministic mapping from source document effects to journal lines. | Posting |

Add terms during the phase that introduces them; do not defer glossary maintenance.
