import type { PermissionDefinition } from "../domain/permission";

export const defaultPermissions: PermissionDefinition[] = [
  {
    code: "system.full-access",
    module: "system",
    title: "دسترسی کامل سیستم",
    description: "مجوز مدیریتی کامل برای مدیر اصلی",
  },
  { code: "security.users.view", module: "security", title: "مشاهده کاربران" },
  {
    code: "security.users.manage",
    module: "security",
    title: "مدیریت کاربران",
  },
  { code: "security.roles.view", module: "security", title: "مشاهده نقش‌ها" },
  { code: "security.roles.manage", module: "security", title: "مدیریت نقش‌ها" },
  {
    code: "security.permissions.view",
    module: "security",
    title: "مشاهده مجوزها",
  },
  {
    code: "security.permissions.assign",
    module: "security",
    title: "انتساب مجوزها",
  },
  {
    code: "company.profile.view",
    module: "company",
    title: "مشاهده اطلاعات شرکت",
  },
  {
    code: "company.profile.manage",
    module: "company",
    title: "مدیریت اطلاعات شرکت",
  },
  {
    code: "company.profile.update-activity-type",
    module: "company",
    title: "تغییر نوع فعالیت شرکت",
    description: "تغییر نوع فعالیت فقط پیشنهاد الگوی کدینگ را به‌روزرسانی می‌کند",
  },
  { code: "company.branches.view", module: "company", title: "مشاهده شعب" },
  { code: "company.branches.manage", module: "company", title: "مدیریت شعب" },
  { code: "fiscal.years.view", module: "fiscal", title: "مشاهده سال‌های مالی" },
  {
    code: "fiscal.years.manage",
    module: "fiscal",
    title: "مدیریت سال‌های مالی",
  },
  {
    code: "fiscal.periods.manage",
    module: "fiscal",
    title: "مدیریت دوره‌های مالی",
  },
  {
    code: "fiscal.locks.manage",
    module: "fiscal",
    title: "مدیریت قفل‌های مالی",
  },
  {
    code: "fiscal.number-series.manage",
    module: "fiscal",
    title: "مدیریت سری شماره‌گذاری",
  },
  {
    code: "accounting.chart-of-accounts.view",
    module: "accounting",
    title: "مشاهده کدینگ حساب‌ها",
  },
  {
    code: "accounting.chart-of-accounts.create",
    module: "accounting",
    title: "ایجاد حساب",
  },
  {
    code: "accounting.chart-of-accounts.update",
    module: "accounting",
    title: "ویرایش اطلاعات حساب",
  },
  {
    code: "accounting.chart-of-accounts.change-code",
    module: "accounting",
    title: "تغییر کد حساب",
  },
  {
    code: "accounting.chart-of-accounts.move",
    module: "accounting",
    title: "تغییر والد حساب",
  },
  {
    code: "accounting.chart-of-accounts.change-status",
    module: "accounting",
    title: "فعال یا غیرفعال‌کردن حساب",
  },
  {
    code: "accounting.chart-of-accounts.delete",
    module: "accounting",
    title: "حذف حساب استفاده‌نشده",
  },
  {
    code: "accounting.chart-of-accounts.manage-settings",
    module: "accounting",
    title: "مدیریت تنظیمات کدینگ",
  },
  {
    code: "accounting.dimensions.view",
    module: "accounting",
    title: "مشاهده ابعاد حسابداری",
  },
  {
    code: "accounting.dimensions.create",
    module: "accounting",
    title: "ایجاد نوع یا عضو بُعد حسابداری",
  },
  {
    code: "accounting.dimensions.update",
    module: "accounting",
    title: "ویرایش نوع یا عضو بُعد حسابداری",
  },
  {
    code: "accounting.dimensions.change-status",
    module: "accounting",
    title: "فعال یا غیرفعال‌کردن ابعاد حسابداری",
  },
  {
    code: "accounting.dimensions.delete",
    module: "accounting",
    title: "حذف نوع یا عضو بُعد حسابداری",
  },
  {
    code: "accounting.dimensions.manage-policies",
    module: "accounting",
    title: "مدیریت سیاست‌های حساب و بُعد",
  },
  {
    code: "audit.entries.view",
    module: "audit",
    title: "مشاهده رویدادهای ممیزی",
  },
  { code: "audit.entries.record", module: "audit", title: "ثبت رویداد ممیزی" },
  {
    code: "approval.requests.view",
    module: "approval",
    title: "مشاهده درخواست‌های تأیید",
  },
  {
    code: "approval.requests.create",
    module: "approval",
    title: "ایجاد درخواست تأیید",
  },
  {
    code: "approval.requests.submit",
    module: "approval",
    title: "ارسال درخواست برای تأیید",
  },
  {
    code: "approval.requests.approve",
    module: "approval",
    title: "تأیید درخواست",
  },
  { code: "approval.requests.reject", module: "approval", title: "رد درخواست" },
  {
    code: "approval.requests.return-to-draft",
    module: "approval",
    title: "بازگرداندن درخواست به پیش‌نویس",
  },
  {
    code: "approval.requests.cancel",
    module: "approval",
    title: "لغو درخواست تأیید",
  },
  {
    code: "approval.requests.comment",
    module: "approval",
    title: "ثبت توضیح روی درخواست تأیید",
  },
];
