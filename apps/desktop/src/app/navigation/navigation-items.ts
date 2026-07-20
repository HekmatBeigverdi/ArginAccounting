export interface NavigationItem {
  label: string;
  path: string;
  group: string;
}

export const navigationItems: NavigationItem[] = [
  {
    label: "داشبورد",
    path: "/dashboard",
    group: "اصلی"
  },
  {
    label: "تعریف شرکت",
    path: "/company/setup",
    group: "اطلاعات پایه"
  },
  {
    label: "سال‌های مالی",
    path: "/fiscal/years",
    group: "مدیریت مالی"
  },
  {
    label: "وضعیت سیستم",
    path: "/system/diagnostics",
    group: "سیستم"
  },
  {
    label: "کاربران",
    path: "/security/users",
    group: "مدیریت سیستم"
  },
  {
    label: "نقش‌ها",
    path: "/security/roles",
    group: "مدیریت سیستم"
  },
  {
    label: "مجوزها",
    path: "/security/permissions",
    group: "مدیریت سیستم"
  },
];
