import type {
  PasswordHasher
} from "../contracts/password-hasher";

import type {
  UserRepository
} from "../contracts/user-repository";

import type {
  UserSummary
} from "../domain/user";

import {
  SecurityValidationError
} from "../validation/security-validation-error";

import {
  normalizeUsername
} from "../validation/security-normalization";

import {
  validatePassword
} from "../validation/password-policy";

export interface CreateUserCommand {
  username: string;
  displayName: string;
  password: string;
  mustChangePassword: boolean;
}

export async function createUser(
  users: UserRepository,
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

  const passwordHash = await passwordHasher.hash(
    command.password
  );

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
}
