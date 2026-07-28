import type {
  DatabaseSession
} from "@argin/database";

import type {
  CreateUserRecordInput,
  User,
  UserRepository,
  UserStatus,
  UserSummary
} from "@argin/security";

interface UserRow {
  id: string;
  username: string;
  normalized_username: string;
  display_name: string;
  password_hash: string;
  status: UserStatus;
  must_change_password: number;
  failed_login_count: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    normalizedUsername:
      row.normalized_username,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    status: row.status,
    mustChangePassword:
      row.must_change_password === 1,
    failedLoginCount:
      row.failed_login_count,
    lockedUntil: row.locked_until,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapUserSummary(
  row: UserRow
): UserSummary {
  const user = mapUser(row);

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    status: user.status,
    mustChangePassword:
      user.mustChangePassword,
    failedLoginCount:
      user.failedLoginCount,
    lockedUntil: user.lockedUntil,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export class SqliteUserRepository
  implements UserRepository {
  constructor(
    private readonly database: DatabaseSession
  ) {}

  async create(
    input: CreateUserRecordInput
  ): Promise<User> {
    const now = new Date().toISOString();

    const user: User = {
      id: crypto.randomUUID(),
      username: input.username,
      normalizedUsername:
        input.normalizedUsername,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      status: input.status,
      mustChangePassword:
        input.mustChangePassword,
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now
    };

    await this.database.execute(
      `
        INSERT INTO users (
          id,
          username,
          normalized_username,
          display_name,
          password_hash,
          status,
          must_change_password,
          failed_login_count,
          locked_until,
          last_login_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        user.id,
        user.username,
        user.normalizedUsername,
        user.displayName,
        user.passwordHash,
        user.status,
        user.mustChangePassword ? 1 : 0,
        user.failedLoginCount,
        user.lockedUntil,
        user.lastLoginAt,
        user.createdAt,
        user.updatedAt
      ]
    );

    return user;
  }

  async findById(
    id: string
  ): Promise<User | null> {
    const row =
      await this.database.queryOne<UserRow>(
        `
          SELECT *
          FROM users
          WHERE id = ?
        `,
        [id]
      );

    return row ? mapUser(row) : null;
  }

  async findByNormalizedUsername(
    normalizedUsername: string
  ): Promise<User | null> {
    const row =
      await this.database.queryOne<UserRow>(
        `
          SELECT *
          FROM users
          WHERE normalized_username = ?
        `,
        [normalizedUsername]
      );

    return row ? mapUser(row) : null;
  }

  async findAll(): Promise<UserSummary[]> {
    const rows =
      await this.database.query<UserRow>(
        `
          SELECT *
          FROM users
          ORDER BY display_name, username
        `
      );

    return rows.map(mapUserSummary);
  }

  async updateStatus(
    userId: string,
    status: UserStatus,
    updatedAt: string
  ): Promise<void> {
    await this.database.execute(
      `
        UPDATE users
        SET
          status = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [status, updatedAt, userId]
    );
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
    mustChangePassword: boolean,
    updatedAt: string
  ): Promise<void> {
    await this.database.execute(
      `
        UPDATE users
        SET
          password_hash = ?,
          must_change_password = ?,
          failed_login_count = 0,
          locked_until = NULL,
          updated_at = ?
        WHERE id = ?
      `,
      [
        passwordHash,
        mustChangePassword ? 1 : 0,
        updatedAt,
        userId
      ]
    );
  }

  async recordSuccessfulLogin(
    userId: string,
    loginAt: string
  ): Promise<void> {
    await this.database.execute(
      `
        UPDATE users
        SET
          failed_login_count = 0,
          locked_until = NULL,
          last_login_at = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [loginAt, loginAt, userId]
    );
  }

  async recordFailedLogin(
    userId: string,
    failedLoginCount: number,
    lockedUntil: string | null,
    updatedAt: string
  ): Promise<void> {
    await this.database.execute(
      `
        UPDATE users
        SET
          failed_login_count = ?,
          locked_until = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [
        failedLoginCount,
        lockedUntil,
        updatedAt,
        userId
      ]
    );
  }
}
