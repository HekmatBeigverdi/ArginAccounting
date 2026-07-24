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

## Initial Terms

| Term | Persian | Definition | Context |
|---|---|---|---|
| Company | شرکت | Legal or operational accounting owner. | Company |
| Branch | شعبه | Operational scope within a company. | Company |
| Fiscal Year | سال مالی | Accounting period container with controlled lifecycle. | Fiscal |
| Permission | مجوز | Stable application-boundary authorization capability. | Security |
| Audit Entry | رویداد حسابرسی | Immutable trace of a significant action and outcome. | Audit |
| Approval Request | درخواست تأیید | Versioned workflow request with append-only decision history. | Approval |
| Journal Voucher | سند حسابداری | Balanced accounting document composed of debit and credit lines. | Accounting |
| Posting Rule | قاعده صدور سند | Deterministic mapping from source document effects to journal lines. | Posting |

Add terms during the phase that introduces them; do not defer glossary maintenance.
