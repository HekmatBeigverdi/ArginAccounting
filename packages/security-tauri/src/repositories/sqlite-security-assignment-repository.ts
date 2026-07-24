import type {
  DatabaseExecutor
} from "@argin/database";

import type {
  SecurityAssignmentRepository
} from "@argin/security";

interface BranchAccessRow {
  branch_id: string;
}

export class SqliteSecurityAssignmentRepository
  implements SecurityAssignmentRepository {
  constructor(
    private readonly database: DatabaseExecutor
  ) {}

  async assignRoleToUser(
    userId: string,
    roleId: string,
    assignedBy: string | null
  ): Promise<void> {
    await this.database.execute(
      `
        INSERT INTO user_roles (
          user_id,
          role_id,
          assigned_at,
          assigned_by
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, role_id)
        DO NOTHING
      `,
      [
        userId,
        roleId,
        new Date().toISOString(),
        assignedBy
      ]
    );
  }

  async removeRoleFromUser(
    userId: string,
    roleId: string
  ): Promise<void> {
    await this.database.execute(
      `
        DELETE FROM user_roles
        WHERE user_id = ?
          AND role_id = ?
      `,
      [userId, roleId]
    );
  }

  async replaceRolePermissions(
    roleId: string,
    permissionIds: string[],
    assignedBy: string | null
  ): Promise<void> {
    await this.database.execute(
      `
        DELETE FROM role_permissions
        WHERE role_id = ?
      `,
      [roleId]
    );

    const now = new Date().toISOString();

    for (const permissionId of permissionIds) {
      await this.database.execute(
        `
          INSERT INTO role_permissions (
            role_id,
            permission_id,
            assigned_at,
            assigned_by
          )
          VALUES (?, ?, ?, ?)
          ON CONFLICT(role_id, permission_id)
          DO UPDATE SET
            assigned_at = excluded.assigned_at,
            assigned_by = excluded.assigned_by
        `,
        [
          roleId,
          permissionId,
          now,
          assignedBy
        ]
      );
    }
  }

  async replaceUserBranchAccess(
    userId: string,
    branchIds: string[],
    assignedBy: string | null
  ): Promise<void> {
    await this.database.execute(
      `
        DELETE FROM user_branch_access
        WHERE user_id = ?
      `,
      [userId]
    );

    const now = new Date().toISOString();

    for (const branchId of branchIds) {
      await this.database.execute(
        `
          INSERT INTO user_branch_access (
            user_id,
            branch_id,
            can_access,
            assigned_at,
            assigned_by
          )
          VALUES (?, ?, 1, ?, ?)
          ON CONFLICT(user_id, branch_id)
          DO UPDATE SET
            can_access = excluded.can_access,
            assigned_at = excluded.assigned_at,
            assigned_by = excluded.assigned_by
        `,
        [
          userId,
          branchId,
          now,
          assignedBy
        ]
      );
    }
  }

  async findBranchIdsByUserId(
    userId: string
  ): Promise<string[]> {
    const rows =
      await this.database.query<BranchAccessRow>(
        `
          SELECT branch_id
          FROM user_branch_access
          WHERE user_id = ?
            AND can_access = 1
          ORDER BY branch_id
        `,
        [userId]
      );

    return rows.map((row) => row.branch_id);
  }

  async replaceUserRoles(
    userId: string,
    roleIds: string[],
    assignedBy: string | null
  ): Promise<void> {
    await this.database.execute(
      `
        DELETE FROM user_roles
        WHERE user_id = ?
      `,
      [userId]
    );

    const now = new Date().toISOString();

    for (const roleId of roleIds) {
      await this.database.execute(
        `
          INSERT INTO user_roles (
            user_id,
            role_id,
            assigned_at,
            assigned_by
          )
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, role_id)
          DO UPDATE SET
            assigned_at = excluded.assigned_at,
            assigned_by = excluded.assigned_by
        `,
        [
          userId,
          roleId,
          now,
          assignedBy
        ]
      );
    }
  }
}
