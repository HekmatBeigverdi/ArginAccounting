import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { useActiveContext } from "../providers/active-context-provider";
import { useAuthSession } from "../providers/auth-session-provider";
import { useDisplayDensity, type DisplayDensity } from "../providers/display-density-provider";
import { navigationItems } from "../navigation/navigation-items";

import "./app-shell.css";

function navigationClassName({ isActive }: { isActive: boolean }): string {
  return isActive
    ? "app-shell__nav-link app-shell__nav-link--active"
    : "app-shell__nav-link";
}

function groupId(group: string): string {
  return `app-nav-group-${group.replace(/[^\p{L}\p{N}]+/gu, "-")}`;
}

const densityOptions: Array<{ value: DisplayDensity; label: string }> = [
  { value: "compact", label: "فشرده" },
  { value: "comfortable", label: "استاندارد" },
  { value: "spacious", label: "بزرگ" },
];

export function AppShell() {
  const { pathname } = useLocation();
  const { session } = useAuthSession();
  const context = useActiveContext();
  const { density, setDensity } = useDisplayDensity();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const permissions = useMemo(
    () => new Set(session?.user.permissions ?? []),
    [session]
  );

  const visibleItems = useMemo(
    () => navigationItems.filter((item) => {
      if (!item.requiredPermission) return true;
      return permissions.has("system.full-access") || permissions.has(item.requiredPermission);
    }),
    [permissions]
  );

  const groups = useMemo(
    () => Array.from(new Set(visibleItems.map((item) => item.group))),
    [visibleItems]
  );

  const currentItem = useMemo(() => {
    return [...visibleItems]
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
  }, [pathname, visibleItems]);

  function toggleGroup(group: string): void {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  return (
    <div className="app-shell" dir="rtl">
      <a className="app-shell__skip-link" href="#app-main-content">پرش به محتوای اصلی</a>
      <aside className="app-shell__sidebar" aria-label="نوار کناری برنامه">
        <div className="app-shell__brand">
          <strong>ArginAccounting</strong>
          <span>نرم‌افزار حسابداری شرکتی آرگین</span>
        </div>

        <nav className="app-shell__nav" aria-label="ناوبری اصلی">
          {groups.map((group) => {
            const collapsed = collapsedGroups.has(group);
            const controlledId = groupId(group);
            return (
              <section key={group} className="app-shell__nav-group">
                <button
                  type="button"
                  className="app-shell__nav-group-header"
                  aria-expanded={!collapsed}
                  aria-controls={controlledId}
                  onClick={() => toggleGroup(group)}
                >
                  <span>{group}</span>
                  <span aria-hidden="true">{collapsed ? "‹" : "⌄"}</span>
                </button>

                <div id={controlledId} hidden={collapsed}>
                  {visibleItems
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <NavLink key={item.path} to={item.path} className={navigationClassName}>
                        {item.label}
                      </NavLink>
                    ))}
                </div>
              </section>
            );
          })}
        </nav>

        <div className="app-shell__user">
          <strong>{session?.user.displayName || "کاربر مهمان"}</strong>
          <span>{session?.user.username || "نشست محلی"}</span>
        </div>
      </aside>

      <div className="app-shell__workspace">
        <header className="app-shell__topbar">
          <div className="app-shell__topbar-row">
            <div>
              <div className="app-shell__breadcrumb" aria-label="مسیر صفحه">
                آرگین / {currentItem?.group ?? "صفحه"}
              </div>
              <h1 className="app-shell__page-title">{currentItem?.label ?? "آرگین"}</h1>
            </div>

            <label className="app-shell__density-field">
              <span>تراکم نمایش</span>
              <select
                value={density}
                aria-label="تراکم نمایش نرم‌افزار"
                onChange={(event) => setDensity(event.target.value as DisplayDensity)}
              >
                {densityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="app-shell__contexts" aria-label="زمینه کاری فعال">
            <label className="app-shell__context-field">
              <span>شرکت فعال</span>
              <select value={context.companyId} disabled={context.isLoading || context.companies.length === 0} onChange={(event) => context.setCompanyId(event.target.value)}>
                {context.companies.length === 0 && <option value="">شرکتی ثبت نشده</option>}
                {context.companies.map((company) => <option key={company.id} value={company.id}>{company.legalName}</option>)}
              </select>
            </label>

            <label className="app-shell__context-field">
              <span>شعبه فعال</span>
              <select value={context.branchId} disabled={!context.companyId || context.branches.length === 0} onChange={(event) => context.setBranchId(event.target.value)}>
                {context.branches.length === 0 && <option value="">شعبه‌ای موجود نیست</option>}
                {context.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>

            <label className="app-shell__context-field">
              <span>سال مالی فعال</span>
              <select value={context.fiscalYearId} disabled={!context.companyId || context.fiscalYears.length === 0} onChange={(event) => context.setFiscalYearId(event.target.value)}>
                {context.fiscalYears.length === 0 && <option value="">سال مالی موجود نیست</option>}
                {context.fiscalYears.map((year) => <option key={year.id} value={year.id}>{year.title}{year.isCurrent ? " — جاری" : ""}</option>)}
              </select>
            </label>
          </div>
        </header>

        <main id="app-main-content" className="app-shell__main" tabIndex={-1}>
          <Outlet />
        </main>

        <footer className="app-shell__statusbar" aria-label="وضعیت برنامه">
          <span>حالت آفلاین</span>
          <span>SQLite</span>
          <span>{context.activeCompany?.legalName ?? "بدون شرکت فعال"}</span>
          {context.error && <span className="app-shell__statusbar-error" role="status">{context.error}</span>}
        </footer>
      </div>
    </div>
  );
}
