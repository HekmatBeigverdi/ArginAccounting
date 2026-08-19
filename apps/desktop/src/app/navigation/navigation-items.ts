export interface NavigationItem {
  label: string;
  path: string;
  group: string;
  requiredPermission?: string;
}

export const navigationItems: NavigationItem[] = [
  {
    label: "داشبورد",
    path: "/dashboard",
    group: "اصلی",
  },
  {
    label: "گردش تأیید",
    path: "/approval/requests",
    group: "اصلی",
  },
  {
    label: "گزارش ممیزی",
    path: "/audit/entries",
    group: "اصلی",
  },
  {
    label: "شرکت‌ها و شعب",
    path: "/company/setup",
    group: "اطلاعات پایه",
  },
  {
    label: "سال‌های مالی",
    path: "/fiscal/years",
    group: "مدیریت مالی",
  },
  {
    label: "اسناد حسابداری",
    path: "/accounting/journal-vouchers",
    group: "حسابداری",
    requiredPermission: "accounting.journal-vouchers.view",
  },
  {
    label: "کدینگ حساب‌ها",
    path: "/accounting/chart-of-accounts",
    group: "حسابداری",
    requiredPermission: "accounting.chart-of-accounts.view",
  },
  {
    label: "ابعاد حسابداری",
    path: "/accounting/dimensions",
    group: "حسابداری",
    requiredPermission: "accounting.dimensions.view",
  },
  {
    label: "الگوهای کدینگ",
    path: "/accounting/coding-templates",
    group: "حسابداری",
    requiredPermission: "accounting.coding-templates.view",
  },
  {
    label: "وضعیت سیستم",
    path: "/system/diagnostics",
    group: "سیستم",
  },
  {
    label: "کاربران",
    path: "/security/users",
    group: "مدیریت سیستم",
  },
  {
    label: "نقش‌ها",
    path: "/security/roles",
    group: "مدیریت سیستم",
  },
  {
    label: "مجوزها",
    path: "/security/permissions",
    group: "مدیریت سیستم",
  },
];
