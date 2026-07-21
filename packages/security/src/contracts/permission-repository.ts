import type {
  Permission,
  PermissionDefinition
} from "../domain/permission";

export interface PermissionRepository {
  upsertDefinitions(
    definitions: PermissionDefinition[]
  ): Promise<void>;

  findAll(): Promise<Permission[]>;

  findByRoleId(roleId: string): Promise<Permission[]>;

  findByUserId(userId: string): Promise<Permission[]>;
}
