import type {
  PasswordHasher
} from "../contracts/password-hasher";

import type {
  SecurityUnitOfWork
} from "../contracts/security-unit-of-work";

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

import {
  defaultPermissions
} from "./default-permissions";

export interface CreateInitialAdministratorCommand {
  username: string;
  displayName: string;
  password: string;
  branchIds?: string[];
}

export async function createInitialAdministrator(
  unitOfWork: SecurityUnitOfWork,
  passwordHasher: PasswordHasher,
  command: CreateInitialAdministratorCommand
): Promise<UserSummary> {
  const issues = validatePassword(
    command.password
  );

  if (command.username.trim().length < 3) {
    issues.push({
      field: "username",
      message:
        "نام کاربری باید حداقل سه نویسه داشته باشد."
    });
  }

  if (
    command.displayName.trim().length === 0
  ) {
    issues.push({
      field: "displayName",
      message: "نام نمایشی الزامی است."
    });
  }

  if (issues.length > 0) {
    throw new SecurityValidationError(
      issues
    );
  }

  const passwordHash =
    await passwordHasher.hash(
      command.password
    );

  return unitOfWork.run(
    async (repositories) => {
      const existingUsers =
        await repositories.users.findAll();

      if (existingUsers.length > 0) {
        throw new SecurityValidationError([
          {
            field: "administrator",
            message:
              "مدیر اولیه قبلاً تعریف شده است."
          }
        ]);
      }

      await repositories.permissions
        .upsertDefinitions(
          defaultPermissions
        );

      let administratorRole =
        await repositories.roles
          .findByNormalizedCode(
            "SYSTEM-ADMINISTRATOR"
          );

      if (administratorRole === null) {
        administratorRole =
          await repositories.roles.create({
            code: "SYSTEM-ADMINISTRATOR",
            normalizedCode:
              "SYSTEM-ADMINISTRATOR",
            title: "مدیر سیستم",
            description:
              "نقش سیستمی با دسترسی کامل",
            isSystem: true,
            isActive: true
          });
      }

      const permissions =
        await repositories.permissions.findAll();

      await repositories.assignments
        .replaceRolePermissions(
          administratorRole.id,
          permissions
            .filter(
              (permission) =>
                permission.isActive
            )
            .map(
              (permission) =>
                permission.id
            ),
          null
        );

      const user =
        await repositories.users.create({
          username:
            command.username.trim(),
          normalizedUsername:
            normalizeUsername(
              command.username
            ),
          displayName:
            command.displayName.trim(),
          passwordHash,
          status: "active",
          mustChangePassword: false
        });

      await repositories.assignments
        .assignRoleToUser(
          user.id,
          administratorRole.id,
          user.id
        );

      await repositories.assignments
        .replaceUserBranchAccess(
          user.id,
          command.branchIds ?? [],
          user.id
        );

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
  );
}
