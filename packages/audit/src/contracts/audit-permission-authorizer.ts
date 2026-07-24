export interface AuditPermissionAuthorizer {
  hasPermission(permissionCode: string): Promise<boolean>;
}
