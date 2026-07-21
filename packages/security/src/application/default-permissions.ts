import type {
  PermissionDefinition
} from "../domain/permission";

export const defaultPermissions:
  PermissionDefinition[] = [
    {
      code: "system.full-access",
      module: "system",
      title: "دسترسی کامل سیستم",
      description:
        "مجوز مدیریتی کامل برای مدیر اصلی"
    },
    {
      code: "security.users.view",
      module: "security",
      title: "مشاهده کاربران"
    },
    {
      code: "security.users.manage",
      module: "security",
      title: "مدیریت کاربران"
    },
    {
      code: "security.roles.view",
      module: "security",
      title: "مشاهده نقش‌ها"
    },
    {
      code: "security.roles.manage",
      module: "security",
      title: "مدیریت نقش‌ها"
    },
    {
      code: "security.permissions.view",
      module: "security",
      title: "مشاهده مجوزها"
    },
    {
      code: "security.permissions.assign",
      module: "security",
      title: "انتساب مجوزها"
    },
    {
      code: "company.profile.view",
      module: "company",
      title: "مشاهده اطلاعات شرکت"
    },
    {
      code: "company.profile.manage",
      module: "company",
      title: "مدیریت اطلاعات شرکت"
    },
    {
      code: "company.branches.view",
      module: "company",
      title: "مشاهده شعب"
    },
    {
      code: "company.branches.manage",
      module: "company",
      title: "مدیریت شعب"
    },
    {
      code: "fiscal.years.view",
      module: "fiscal",
      title: "مشاهده سال‌های مالی"
    },
    {
      code: "fiscal.years.manage",
      module: "fiscal",
      title: "مدیریت سال‌های مالی"
    },
    {
      code: "fiscal.periods.manage",
      module: "fiscal",
      title: "مدیریت دوره‌های مالی"
    },
    {
      code: "fiscal.locks.manage",
      module: "fiscal",
      title: "مدیریت قفل‌های مالی"
    },
    {
      code: "fiscal.number-series.manage",
      module: "fiscal",
      title: "مدیریت سری شماره‌گذاری"
    }
  ];
