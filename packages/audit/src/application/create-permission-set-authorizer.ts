import type {
  AuditPermissionAuthorizer
} from "../contracts/audit-permission-authorizer.ts";

export function createPermissionSetAuthorizer(
  permissionCodes: Iterable<string>
): AuditPermissionAuthorizer {
  const permissions = new Set(permissionCodes);

  return {
    async hasPermission(permissionCode: string): Promise<boolean> {
      return permissions.has(permissionCode);
    }
  };
}
