import type {
  RoleRepository
} from "../contracts/role-repository";

import type {
  Role
} from "../domain/role";

import {
  SecurityValidationError
} from "../validation/security-validation-error";

import {
  normalizeRoleCode
} from "../validation/security-normalization";

export interface CreateRoleCommand {
  code: string;
  title: string;
  description?: string | null;
}

export async function createRole(
  roles: RoleRepository,
  command: CreateRoleCommand
): Promise<Role> {
  const normalizedCode =
    normalizeRoleCode(command.code);

  if (normalizedCode.length < 2) {
    throw new SecurityValidationError([
      {
        field: "code",
        message: "کد نقش معتبر نیست."
      }
    ]);
  }

  if (command.title.trim().length === 0) {
    throw new SecurityValidationError([
      {
        field: "title",
        message: "عنوان نقش الزامی است."
      }
    ]);
  }

  const existing =
    await roles.findByNormalizedCode(
      normalizedCode
    );

  if (existing !== null) {
    throw new SecurityValidationError([
      {
        field: "code",
        message: "این کد نقش قبلاً ثبت شده است."
      }
    ]);
  }

  return roles.create({
    code: command.code.trim(),
    normalizedCode,
    title: command.title.trim(),
    description:
      command.description?.trim() || null,
    isSystem: false,
    isActive: true
  });
}
