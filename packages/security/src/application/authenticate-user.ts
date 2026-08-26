import type {
  PasswordHasher
} from "../contracts/password-hasher.ts";

import type {
  PermissionRepository
} from "../contracts/permission-repository.ts";

import type {
  RoleRepository
} from "../contracts/role-repository.ts";

import type {
  SecurityAssignmentRepository
} from "../contracts/security-assignment-repository.ts";

import type {
  UserRepository
} from "../contracts/user-repository.ts";

import type {
  AuthSession
} from "../domain/auth-session.ts";

import {
  SecurityValidationError
} from "../validation/security-validation-error.ts";

import {
  normalizeUsername
} from "../validation/security-normalization.ts";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export interface AuthenticateUserCommand {
  username: string;
  password: string;
}

export async function authenticateUser(
  users: UserRepository,
  roles: RoleRepository,
  permissions: PermissionRepository,
  assignments: SecurityAssignmentRepository,
  passwordHasher: PasswordHasher,
  command: AuthenticateUserCommand
): Promise<AuthSession> {
  const user =
    await users.findByNormalizedUsername(
      normalizeUsername(command.username)
    );

  if (user === null) {
    throw new SecurityValidationError([
      {
        field: "credentials",
        message:
          "نام کاربری یا رمز عبور نادرست است."
      }
    ]);
  }

  if (user.status === "inactive") {
    throw new SecurityValidationError([
      {
        field: "credentials",
        message: "حساب کاربری غیرفعال است."
      }
    ]);
  }

  const now = new Date();

  if (
    user.lockedUntil !== null &&
    new Date(user.lockedUntil).getTime() >
      now.getTime()
  ) {
    throw new SecurityValidationError([
      {
        field: "credentials",
        message:
          "حساب کاربری موقتاً قفل شده است."
      }
    ]);
  }

  const isValid = await passwordHasher.verify(
    command.password,
    user.passwordHash
  );

  if (!isValid) {
    const failedCount =
      user.failedLoginCount + 1;

    const lockedUntil =
      failedCount >= MAX_FAILED_ATTEMPTS
        ? new Date(
            now.getTime() +
              LOCK_MINUTES * 60 * 1000
          ).toISOString()
        : null;

    await users.recordFailedLogin(
      user.id,
      failedCount,
      lockedUntil,
      now.toISOString()
    );

    throw new SecurityValidationError([
      {
        field: "credentials",
        message:
          "نام کاربری یا رمز عبور نادرست است."
      }
    ]);
  }

  const loginAt = now.toISOString();

  await users.recordSuccessfulLogin(
    user.id,
    loginAt
  );

  const userRoles =
    await roles.findByUserId(user.id);

  const userPermissions =
    await permissions.findByUserId(user.id);

  const branchIds =
    await assignments.findBranchIdsByUserId(
      user.id
    );

  return {
    authenticatedAt: loginAt,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      mustChangePassword:
        user.mustChangePassword,
      roleCodes: userRoles.map(
        (role) => role.code
      ),
      permissions: userPermissions.map(
        (permission) => permission.code
      ),
      branchIds
    }
  };
}
