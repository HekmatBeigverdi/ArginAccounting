import type { AuditPermissionAuthorizer } from "../contracts/audit-permission-authorizer.ts";

export const auditPermissions = {
  entriesView: "audit.entries.view",
  entriesRecord: "audit.entries.record",
  approvalsView: "approval.requests.view",
  approvalsCreate: "approval.requests.create",
  approvalsSubmit: "approval.requests.submit",
  approvalsApprove: "approval.requests.approve",
  approvalsReject: "approval.requests.reject",
  approvalsReturnToDraft: "approval.requests.return-to-draft",
  approvalsCancel: "approval.requests.cancel",
  approvalsComment: "approval.requests.comment"
} as const;

export type AuditPermissionCode =
  (typeof auditPermissions)[keyof typeof auditPermissions];

export class AuditPermissionDeniedError extends Error {
  constructor(readonly permission: AuditPermissionCode) {
    super(`Permission "${permission}" is required.`);
    this.name = "AuditPermissionDeniedError";
    Object.setPrototypeOf(this, AuditPermissionDeniedError.prototype);
  }
}

export async function requireAuditPermission(
  authorizer: AuditPermissionAuthorizer,
  permission: AuditPermissionCode
): Promise<void> {
  const hasFullAccess = await authorizer.hasPermission("system.full-access");
  if (hasFullAccess || await authorizer.hasPermission(permission)) return;
  throw new AuditPermissionDeniedError(permission);
}
