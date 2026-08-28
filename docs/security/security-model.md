# Security Model

## Scope

Security covers identity, authenticated session, roles, permissions, company and branch access, approval authority, accounting-report scope, audit visibility, and sensitive-data handling.

## Principles

- Deny by default.
- Authorization is enforced in application services, not only in UI.
- Permissions are explicit capabilities, not inferred from page access.
- Company and branch scope is validated for every protected operation.
- Approval authority is separate from document creation where segregation of duties applies.
- Sensitive values are excluded or sanitized in logs and audit snapshots.
- Security-relevant mutations are auditable.

## Session

Desktop sessions expose a stable authenticated principal and selected organizational context. Infrastructure credentials and secrets never enter domain models or persisted audit snapshots.

## Permissions

Permission names follow `<module>.<resource>.<action>`. Seed changes are versioned and tested. UI gates improve usability but never replace application authorization.

### Chart of Accounts

- `accounting.chart-of-accounts.view`
- `accounting.chart-of-accounts.create`
- `accounting.chart-of-accounts.update`
- `accounting.chart-of-accounts.move`
- `accounting.chart-of-accounts.change-status`
- `accounting.chart-of-accounts.manage-settings`
- `accounting.chart-of-accounts.delete`

`system.full-access` covers all Chart of Accounts operations. Mutations preserve company scope, actor identity, source, correlation ID, and causation ID in audit events.

### Accounting Dimensions

- `accounting.dimensions.view`
- `accounting.dimensions.create`
- `accounting.dimensions.update`
- `accounting.dimensions.change-status`
- `accounting.dimensions.delete`
- `accounting.dimensions.manage-policies`

Dimension operations are company-scoped and authorized at the Application Service boundary. Mutations use optimistic concurrency and publish complete before/after audit evidence only after the transaction commits.

### Coding Templates

- `accounting.coding-templates.view`
- `accounting.coding-templates.create`
- `accounting.coding-templates.update-draft`
- `accounting.coding-templates.publish`
- `accounting.coding-templates.retire`
- `accounting.coding-templates.preview`
- `accounting.coding-templates.apply`
- `accounting.coding-templates.upgrade`
- `accounting.coding-templates.import`
- `accounting.coding-templates.view-history`

Template lifecycle and company application/import commands are authorized at the Application Service boundary. Built-in mutation is restricted to privileged system administration. Atomic failure and rollback publish no success event; committed events preserve actor, company, source, correlation, causation, version, fingerprint, and request identity.

### Journal Vouchers

Base Journal permissions:

- `accounting.journal-vouchers.view`
- `accounting.journal-vouchers.create`
- `accounting.journal-vouchers.update-draft`
- `accounting.journal-vouchers.delete-draft`
- `accounting.journal-vouchers.view-history`

Lifecycle permissions:

- `accounting.journal-vouchers.submit`
- `accounting.journal-vouchers.approve`
- `accounting.journal-vouchers.reject`
- `accounting.journal-vouchers.return-to-draft`
- `accounting.journal-vouchers.cancel-approval`
- `accounting.journal-vouchers.post`
- `accounting.journal-vouchers.reopen-for-amendment`
- `accounting.journal-vouchers.reverse`

Journal read and mutation operations are authorized at the Application boundary. UI permission gates are convenience only and cannot bypass application authorization. Cross-company mutation attempts are hidden as not-found behavior rather than exposing another company's aggregate.

Every lifecycle command handler checks its dedicated permission before invoking Approval, Posting, Amendment, or Reversal services. Approval outcomes do not share one broad permission: approve, reject, return-to-draft, and cancel-approval are independently assignable.

The default Journal segregation-of-duties policy prohibits self-approval for the current approval cycle. No project-wide rule currently requires the poster or reverser to be a different user; those operations are protected by separate granular permissions and actor evidence.

Authorization failures use stable Application error codes. `journal.unauthorized` represents missing permission and `journal.segregation-of-duties-violation` represents actor-policy failure.

Create retries use a durable request identity. A previously committed `(companyId, requestId)` returns the existing voucher and does not allocate a second committed voucher or publish a duplicate created event.

### Accounting Reports

Report permissions are granular by report family:

- `accounting.reports.trial-balance.view`
- `accounting.reports.general-ledger.view`
- `accounting.reports.subsidiary-ledger.view`
- `accounting.reports.journal.view`
- `accounting.reports.dimensions.view`
- `accounting.reports.export`

`SecuredAccountingReportQueryService` is the Application security boundary for report reads. It verifies the report-specific view permission and exact Company/Branch scope before canonical report execution. A request for all branches is permitted only when the actor has access to all active branches of the selected company (or `system.full-access`). A request for one branch must match an authorized branch belonging to the selected company.

Report scope denial uses stable non-leaking errors (`report.unauthorized`, `report.scope-denied`) without exposing cross-scope identifiers in error details. UI tab/navigation visibility is usability only and is not an authorization boundary.

Export is separately authorized. Preview, Excel, native Print, and PDF actions recheck `accounting.reports.export` plus the exact executed Company/Branch scope before output is generated.

## Audit and Approval

Audit history is append-only. Approval transitions require valid state, permission, scope, actor, and optimistic-concurrency version. Multi-record changes commit atomically.

Chart of Accounts changes publish audit events only after successful commit. Physical deletion records the complete previous account snapshot. Used accounts cannot be deleted; policy-controlled code changes and stale versions are rejected at the application boundary.

Persisted journal lines and dimension assignments are financial-usage evidence for the existing Chart of Accounts and Accounting Dimension integrity guards.

Accounting reporting is read-only in Phase 16. Report execution does not mutate Journal facts or create a second financial source of truth.

## Future Online Runtime

The future API must preserve the same application authorization contracts and add secure token validation, transport security, rate limits, server-side tenant enforcement, and identical report Company/Branch scope semantics.
