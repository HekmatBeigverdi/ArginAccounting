export interface NavigationItem {
  label: string;
  path: string;
  group: string;
  requiredPermission?: string;
  requiredAnyPermissions?: readonly string[];
}

export const navigationItems: NavigationItem[] = [
  { label: "داشبورد", path: "/dashboard", group: "اصلی" },
  { label: "گردش تأیید", path: "/approval/requests", group: "اصلی" },
  { label: "گزارش ممیزی", path: "/audit/entries", group: "اصلی" },
  { label: "شرکت‌ها و شعب", path: "/company/setup", group: "اطلاعات پایه" },
  {
    label: "اشخاص",
    path: "/master-data/parties",
    group: "اطلاعات پایه",
    requiredPermission: "master-data.parties.view",
  },
  {
    label: "کالاها و خدمات",
    path: "/master-data/products",
    group: "اطلاعات پایه",
    requiredPermission: "master-data.products.view",
  },
  { label: "سال‌های مالی", path: "/fiscal/years", group: "مدیریت مالی" },
  {
    label: "اسناد حسابداری",
    path: "/accounting/journal-vouchers",
    group: "حسابداری",
    requiredPermission: "accounting.journal-vouchers.view",
  },
  {
    label: "گزارش‌های حسابداری",
    path: "/accounting/reports",
    group: "حسابداری",
    requiredAnyPermissions: [
      "accounting.reports.trial-balance.view",
      "accounting.reports.general-ledger.view",
      "accounting.reports.subsidiary-ledger.view",
      "accounting.reports.journal.view",
      "accounting.reports.dimensions.view",
    ],
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
  { label: "ورود به سیستم", path: "/login", group: "مدیریت سیستم" },
  { label: "وضعیت سیستم", path: "/system/diagnostics", group: "مدیریت سیستم" },
  { label: "کاربران", path: "/security/users", group: "مدیریت سیستم" },
  { label: "نقش‌ها", path: "/security/roles", group: "مدیریت سیستم" },
  { label: "مجوزها", path: "/security/permissions", group: "مدیریت سیستم" },
];
