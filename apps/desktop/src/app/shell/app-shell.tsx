import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

import { useActiveContext } from "../providers/active-context-provider";
import { useAuthSession } from "../providers/auth-session-provider";
import { useDisplayDensity, type DisplayDensity } from "../providers/display-density-provider";
import { navigationItems } from "../navigation/navigation-items";
import brandLogo from "../../assets/argin-ui/argin-logo.png";
import brandWave from "../../assets/argin-ui/sidebar-wave.svg";
import searchIcon from "../../assets/argin-ui/utility-search.svg";
import notificationIcon from "../../assets/argin-ui/utility-bell.svg";
import profileIcon from "../../assets/argin-ui/profile-avatar.svg";
import connectionDot from "../../assets/argin-ui/connection-dot.svg";
import dashboardIcon from "../../assets/argin-ui/nav-dashboard.svg";
import approvalIcon from "../../assets/argin-ui/nav-approval.svg";
import auditIcon from "../../assets/argin-ui/nav-audit.svg";
import companyIcon from "../../assets/argin-ui/nav-companies.svg";
import fiscalIcon from "../../assets/argin-ui/nav-fiscal-years.svg";
import systemIcon from "../../assets/argin-ui/nav-system.svg";
import usersIcon from "../../assets/argin-ui/nav-users.svg";
import rolesIcon from "../../assets/argin-ui/nav-roles.svg";
import permissionsIcon from "../../assets/argin-ui/nav-permissions.svg";
import vouchersIcon from "../../assets/argin-ui/nav-accounting-vouchers.svg";
import reportsIcon from "../../assets/argin-ui/nav-accounting-reports.svg";

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
  const navigate = useNavigate();
  const { session } = useAuthSession();
  const context = useActiveContext();
  const { density, setDensity } = useDisplayDensity();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function focusGlobalSearch(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener("keydown", focusGlobalSearch);
    return () => window.removeEventListener("keydown", focusGlobalSearch);
  }, []);

  const permissions = useMemo(
    () => new Set(session?.user.permissions ?? []),
    [session]
  );

  const visibleItems = useMemo(
    () => navigationItems.filter((item) => {
      if (permissions.has("system.full-access")) return true;
      if (item.requiredPermission && !permissions.has(item.requiredPermission)) return false;
      if (item.requiredAnyPermissions && !item.requiredAnyPermissions.some((permission) => permissions.has(permission))) return false;
      return true;
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

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("fa-IR");
    if (!query) return [];
    return visibleItems
      .filter((item) => item.label.toLocaleLowerCase("fa-IR").includes(query))
      .slice(0, 6);
  }, [searchQuery, visibleItems]);

  function navigationIcon(path: string): string {
    if (path === "/dashboard") return dashboardIcon;
    if (path.startsWith("/approval")) return approvalIcon;
    if (path.startsWith("/audit")) return auditIcon;
    if (path.startsWith("/company")) return companyIcon;
    if (path.startsWith("/fiscal")) return fiscalIcon;
    if (path.startsWith("/system")) return systemIcon;
    if (path.startsWith("/security/users")) return usersIcon;
    if (path.startsWith("/security/roles")) return rolesIcon;
    if (path.startsWith("/security/permissions")) return permissionsIcon;
    if (path.startsWith("/accounting/reports")) return reportsIcon;
    if (path.startsWith("/accounting")) return vouchersIcon;
    if (path.startsWith("/master-data/parties")) return usersIcon;
    if (path.startsWith("/master-data")) return companyIcon;
    if (path.startsWith("/inventory")) return reportsIcon;
    if (path.startsWith("/purchases") || path.startsWith("/sales")) return vouchersIcon;
    return systemIcon;
  }

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
          <img className="app-shell__brand-logo" src={brandLogo} alt="نشان آرگین" />
          <div className="app-shell__brand-copy">
            <span>نرم‌افزار</span>
            <strong>حسابداری آرگین</strong>
          </div>
          <img className="app-shell__brand-wave" src={brandWave} alt="" aria-hidden="true" />
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
                        <img className="app-shell__nav-icon" src={navigationIcon(item.path)} alt="" aria-hidden="true" />
                        {item.label}
                      </NavLink>
                    ))}
                </div>
              </section>
            );
          })}
        </nav>

        <div className="app-shell__user">
          <img className="app-shell__user-avatar" src={profileIcon} alt="" aria-hidden="true" />
          <span className="app-shell__user-copy">
            <strong>{session?.user.displayName || "کاربر مهمان"}</strong>
            <small>{session?.user.username || "نشست محلی"}</small>
          </span>
          <div className="app-shell__active-company">
            <span>شرکت فعال</span>
            <strong>{context.activeCompany?.legalName ?? "شرکتی انتخاب نشده"}</strong>
            <small><img src={connectionDot} alt="" aria-hidden="true" /> SQLite · محلی</small>
          </div>
        </div>
      </aside>

      <div className="app-shell__workspace">
        <header className="app-shell__topbar">
          <div className="app-shell__topbar-row">
            <div className="app-shell__utility" dir="ltr">
              <label className="app-shell__search">
                <img src={searchIcon} alt="" aria-hidden="true" />
                <input
                  ref={searchRef}
                  aria-label="جست‌وجو در آرگین"
                  placeholder="جست‌وجو در آرگین..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setIsSearchFocused(false), 120)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && searchResults[0]) {
                      navigate(searchResults[0].path);
                      setSearchQuery("");
                      setIsSearchFocused(false);
                    }
                    if (event.key === "Escape") {
                      setSearchQuery("");
                      setIsSearchFocused(false);
                      searchRef.current?.blur();
                    }
                  }}
                />
                <kbd>Ctrl + K</kbd>
                {isSearchFocused && searchResults.length > 0 ? (
                  <div className="app-shell__search-results" dir="rtl">
                    {searchResults.map((item) => (
                      <NavLink key={item.path} to={item.path} onClick={() => setSearchQuery("")}>
                        <img src={navigationIcon(item.path)} alt="" aria-hidden="true" />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </label>
              <span className="app-shell__notification" aria-label="اعلان‌ها" title="اعلان‌ها">
                <img src={notificationIcon} alt="" aria-hidden="true" />
                <i aria-hidden="true" />
              </span>
              <div className="app-shell__profile-chip">
                <span>{session?.user.displayName || "کاربر مهمان"}<small>{session?.user.username || "مدیر سیستم"}</small></span>
                <img src={profileIcon} alt="" aria-hidden="true" />
              </div>
            </div>

            <div className="app-shell__page-heading" dir="rtl">
              <div className="app-shell__breadcrumb" aria-label="مسیر صفحه">
                آرگین / {currentItem?.group ?? "صفحه"}
              </div>
              <h1 className="app-shell__page-title">{currentItem?.label ?? "آرگین"}</h1>
            </div>

            <label className="app-shell__density-field" dir="rtl">
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
