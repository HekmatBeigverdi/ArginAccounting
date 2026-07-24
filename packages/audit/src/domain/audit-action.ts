export const auditActions = [
  "create",
  "update",
  "delete",
  "restore",
  "submit",
  "approve",
  "reject",
  "cancel",
  "login",
  "logout",
  "login-failed",
  "password-change",
  "status-change",
  "assign",
  "unassign",
  "export",
  "import",
  "print",
  "view"
] as const;

export type AuditAction =
  (typeof auditActions)[number];

export function isAuditAction(
  value: string
): value is AuditAction {
  return auditActions.includes(
    value as AuditAction
  );
}
