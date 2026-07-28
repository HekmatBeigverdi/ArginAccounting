import type {
  DatabaseSession
} from "@argin/database";

import type {
  CreateRoleInput,
  Role,
  RoleRepository
} from "@argin/security";

interface RoleRow {
  id: string;
  code: string;
  normalized_code: string;
  title: string;
  description: string | null;
  is_system: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapRole(row: RoleRow): Role {
  return {
    id: row.id,
    code: row.code,
    normalizedCode: row.normalized_code,
    title: row.title,
    description: row.description,
    isSystem: row.is_system === 1,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SqliteRoleRepository
  implements RoleRepository {
  constructor(
    private readonly database: DatabaseSession
  ) {}

  async create(
    input: CreateRoleInput
  ): Promise<Role> {
    const now = new Date().toISOString();

    const role: Role = {
      id: crypto.randomUUID(),
      code: input.code,
      normalizedCode:
        input.normalizedCode,
      title: input.title,
      description:
        input.description ?? null,
      isSystem: input.isSystem ?? false,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now
    };

    await this.database.execute(
      `
        INSERT INTO roles (
          id,
          code,
          normalized_code,
          title,
          description,
          is_system,
          is_active,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        role.id,
        role.code,
        role.normalizedCode,
        role.title,
        role.description,
        role.isSystem ? 1 : 0,
        role.isActive ? 1 : 0,
        role.createdAt,
        role.updatedAt
      ]
    );

    return role;
  }

  async findById(
    id: string
  ): Promise<Role | null> {
    const row =
      await this.database.queryOne<RoleRow>(
        `
          SELECT *
          FROM roles
          WHERE id = ?
        `,
        [id]
      );

    return row ? mapRole(row) : null;
  }

  async findByNormalizedCode(
    normalizedCode: string
  ): Promise<Role | null> {
    const row =
      await this.database.queryOne<RoleRow>(
        `
          SELECT *
          FROM roles
          WHERE normalized_code = ?
        `,
        [normalizedCode]
      );

    return row ? mapRole(row) : null;
  }

  async findAll(): Promise<Role[]> {
    const rows =
      await this.database.query<RoleRow>(
        `
          SELECT *
          FROM roles
          ORDER BY is_system DESC, title
        `
      );

    return rows.map(mapRole);
  }

  async findByUserId(
    userId: string
  ): Promise<Role[]> {
    const rows =
      await this.database.query<RoleRow>(
        `
          SELECT r.*
          FROM roles r
          INNER JOIN user_roles ur
            ON ur.role_id = r.id
          WHERE ur.user_id = ?
            AND r.is_active = 1
          ORDER BY r.title
        `,
        [userId]
      );

    return rows.map(mapRole);
  }
}
