import type {
  SecurityUnitOfWork
} from "../contracts/security-unit-of-work.ts";

import {
  defaultPermissions
} from "./default-permissions.ts";

export interface BootstrapSecurityResult {
  administratorRoleId: string;
}

export async function bootstrapSecurity(
  unitOfWork: SecurityUnitOfWork
): Promise<BootstrapSecurityResult> {
  return unitOfWork.run(
    async (repositories) => {
      await repositories.permissions
        .upsertDefinitions(defaultPermissions);

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

      const allPermissions =
        await repositories.permissions.findAll();

      await repositories.assignments
        .replaceRolePermissions(
          administratorRole.id,
          allPermissions.map(
            (permission) => permission.id
          ),
          null
        );

      return {
        administratorRoleId:
          administratorRole.id
      };
    }
  );
}
