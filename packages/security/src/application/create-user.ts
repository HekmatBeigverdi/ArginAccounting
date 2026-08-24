import type {
  PasswordHasher
} from "../contracts/password-hasher.ts";

import type {
  SecurityUnitOfWork
} from "../contracts/security-unit-of-work.ts";

import type {
  UserSummary
} from "../domain/user.ts";

import {
  SecurityValidationError
} from "../validation/security-validation-error.ts";

import {
  normalizeUsername
} from "../validation/security-normalization.ts";

import {
  validatePassword
} from "../validation/password-policy.ts";

export interface CreateUserCommand {
  username: string;
  displayName: string;
  password: string;
  mustChangePassword: boolean;
}

export async function createUser(
  unitOfWork: SecurityUnitOfWork,
  passwordHasher: PasswordHasher,
  command: CreateUserCommand
): Promise<UserSummary> {
  const issues = validatePassword(command.password);

  if (command.username.trim().length < 3) {
    issues.push({
      field: "username",
      message:
        "نام کاربری باید حداقل سه نویسه داشته باشد."
    });
  }

  if (command.displayName.trim().length === 0) {
    issues.push({
      field: "displayName",
      message: "نام نمایشی الزامی است."
    });
  }

  if (issues.length > 0) {
    throw new SecurityValidationError(issues);
  }

  const normalizedUsername =
    normalizeUsername(command.username);

  const passwordHash = await passwordHasher.hash(
    command.password
  );

  return unitOfWork.run(async ({ users }) => {
    const existing =
      await users.findByNormalizedUsername(
        normalizedUsername
      );

    if (existing !== null) {
      throw new SecurityValidationError([
        {
          field: "username",
          message: "این نام کاربری قبلاً ثبت شده است."
        }
      ]);
    }

    const user = await users.create({
      username: command.username.trim(),
      normalizedUsername,
      displayName: command.displayName.trim(),
      passwordHash,
      status: "active",
      mustChangePassword:
        command.mustChangePassword
    });

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      failedLoginCount: user.failedLoginCount,
      lockedUntil: user.lockedUntil,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  });
}
