# Party Security and Audit

## Scope

Phase 17 Party Master Data is company-scoped and protected at the Application boundary. UI visibility is convenience only and never replaces authorization.

## Permissions

- `master-data.parties.view`
- `master-data.parties.create`
- `master-data.parties.update`
- `master-data.parties.change-status`
- `master-data.parties.manage-roles`
- `master-data.parties.import`
- `master-data.parties.export`

`SecuredPartyReader` requires view permission before delegating to the underlying reader and carries actor/company/correlation/request context into authorization. `SecuredPartyApplicationService` checks the mutation-specific permission before persistence.

Creating a Party with Customer/Supplier roles requires both create permission and role-management permission. Status changes and role changes use their own permissions.

## Company Scope

All protected Party reads and writes require explicit `companyId`. Repository and reader queries are company-scoped and the security boundary does not expose cross-company Party data.

## Audit

Successful create, update, status, role, import, and export operations emit Party audit events. Desktop composition maps them into the shared append-only Audit infrastructure with:

- actor ID;
- company ID;
- durable Party target ID where applicable;
- correlation ID;
- request ID;
- occurrence timestamp;
- canonical audit action;
- Party operation metadata.

Idempotent create replay does not emit a duplicate mutation audit event.

Audit recording is an internal consequence of an already-authorized Party command. Users do not require a separate `audit.entries.record` UI permission merely for their successful Party operation to be audited.

## Approval

Phase 17 deliberately adds no Party-specific approval workflow. Routine Party CRUD, lifecycle, role management, import, and export do not meet the current Approval architecture threshold for an additional state machine. If later regulated workflows require Party approval, they must be introduced explicitly rather than inferred from Phase 17.

## Sensitive Master Data

Iranian national code, legal national identifier, economic/tax identifiers, contact values, and addresses are sensitive Master Data. Logs and diagnostics should prefer stable IDs/error codes and avoid unnecessary raw-value disclosure. Audit metadata must remain purpose-specific rather than copying complete Party records by default.

## Future Online Runtime

Future API/Argin Bridge adapters must preserve the same permission names, company-scope rules, stable Application errors, durable Party identity, and audit actor/context semantics. Transport authentication does not replace the Application authorization boundary.
