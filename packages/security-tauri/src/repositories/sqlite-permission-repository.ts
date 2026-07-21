import type {
  DatabaseExecutor
} from "@argin/database";

import type {
  Permission,
  PermissionDefinition,
  PermissionModule,
  PermissionRepository
} from "@argin/security";

interface PermissionRow {
  id: string;
  code: string;
  module: PermissionModule;
  title: string;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapPermission(
  row: PermissionRow
): Permission {
  return {
    id: row.id,
    code: row.code,
    module: row.module,
    title: row.title,
    description: row.description,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SqlitePermissionRepository
  implements PermissionRepository {
  constructor(
    private readonly database: DatabaseExecutor
  ) {}

  async upsertDefinitions(
    definitions: PermissionDefinition[]
  ): Promise<void> {
    const now = new Date().toISOString();

    for (const definition of definitions) {
      await this.database.execute(
        `
          INSERT INTO permissions (
            id,
            code,
            module,
            title,
            description,
            is_active,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(code)
          DO UPDATE SET
            module = excluded.module,
            title = excluded.title,
            description = excluded.description,
            is_active = 1,
            updated_at = excluded.updated_at
        `,
        [
          crypto.randomUUID(),
          definition.code,
          definition.module,
          definition.title,
          definition.description ?? null,
          now,
          now
        ]
      );
    }
  }

  async findAll(): Promise<Permission[]> {
    const rows =
      await this.database.query<PermissionRow>(
        `
          SELECT *
          FROM permissions
          ORDER BY module, code
        `
      );

    return rows.map(mapPermission);
  }

  async findByRoleId(
    roleId: string
  ): Promise<Permission[]> {
    const rows =
      await this.database.query<PermissionRow>(
        `
          SELECT p.*
          FROM permissions p
          INNER JOIN role_permissions rp
            ON rp.permission_id = p.id
          WHERE rp.role_id = ?
            AND p.is_active = 1
          ORDER BY p.module, p.code
        `,
        [roleId]
      );

    return rows.map(mapPermission);
  }

  async findByUserId(
    userId: string
  ): Promise<Permission[]> {
    const rows =
      await this.database.query<PermissionRow>(
        `
          SELECT DISTINCT p.*
          FROM permissions p
          INNER JOIN role_permissions rp
            ON rp.permission_id = p.id
          INNER JOIN user_roles ur
            ON ur.role_id = rp.role_id
          INNER JOIN roles r
            ON r.id = ur.role_id
          WHERE ur.user_id = ?
            AND p.is_active = 1
            AND r.is_active = 1
          ORDER BY p.module, p.code
        `,
        [userId]
      );

    return rows.map(mapPermission);
  }
}
