import type {
  Permission,
  PermissionDefinition
} from "../domain/permission.ts";

export interface PermissionRepository {
  upsertDefinitions(
    definitions: PermissionDefinition[]
  ): Promise<void>;

  findAll(): Promise<Permission[]>;

  findByRoleId(roleId: string): Promise<Permission[]>;

  findByUserId(userId: string): Promise<Permission[]>;
}
