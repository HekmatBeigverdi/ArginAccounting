import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { useActiveContext } from "../providers/active-context-provider";
import { useAuthSession } from "../providers/auth-session-provider";
import { useDisplayDensity, type DisplayDensity } from "../providers/display-density-provider";
import { navigationItems, type NavigationItem } from "../navigation/navigation-items";

import accountAvatar from "./assets/reference/account-avatar.svg";
import activeIconBackdrop from "./assets/reference/active-icon-backdrop.svg";
import activeIndicator from "./assets/reference/active-indicator.svg";
import activeNavigation from "./assets/reference/active-navigation.svg";
import brandContour from "./assets/reference/brand-contour.svg";
import chevronBackground from "./assets/reference/chevron-background.svg";
import iconBackground from "./assets/reference/nav-icon-background.svg";
import logoMedallion from "./assets/reference/logo-medallion.svg";
import menuCapsule from "./assets/reference/menu-capsule.svg";
import navChevron from "./assets/reference/nav-chevron.svg";
import activeNavChevron from "./assets/reference/nav-chevron-active.svg";
import notificationBell from "./assets/reference/notification-bell.svg";
import notificationUnread from "./assets/reference/notification-unread.svg";
import officialArginLogo from "./assets/reference/official-argin-logo.png";
import profileChevron from "./assets/reference/profile-chevron.svg";
import searchIcon from "./assets/reference/search.svg";
import settingsChevron from "./assets/reference/settings-chevron.svg";
import settingsGear from "./assets/reference/settings-gear.svg";
import navAccountingIcon from "./assets/reference/nav-accounting.svg";
import navBaseIcon from "./assets/reference/nav-base.svg";
import navDashboardIcon from "./assets/reference/nav-dashboard.svg";
import navFinanceIcon from "./assets/reference/nav-finance.svg";
import navInventoryIcon from "./assets/reference/nav-inventory.svg";
import navPurchaseIcon from "./assets/reference/nav-purchase.svg";
import navReportsIcon from "./assets/reference/nav-reports.svg";
import navSalesIcon from "./assets/reference/nav-sales.svg";
import navSystemIcon from "./assets/reference/nav-system.svg";
import navTreasuryIcon from "./assets/reference/nav-treasury.svg";
import { Feedback } from "../../components/feedback";
import "./app-shell.css";

type NavigationSection = {
  key: string;
  label: string;
  icon: string;
  items: NavigationItem[];
};

const sectionDefinitions = [
  { key: "base", label: "اطلاعات پایه", icon: navBaseIcon },
  { key: "finance", label: "مدیریت مالی", icon: navFinanceIcon },
  { key: "accounting", label: "حسابداری", icon: navAccountingIcon },
  { key: "inventory", label: "انبار و موجودی", icon: navInventoryIcon },
  { key: "purchases", label: "خرید و تدارکات", icon: navPurchaseIcon },
  { key: "sales", label: "فروش", icon: navSalesIcon },
  { key: "treasury", label: "خزانه‌داری", icon: navTreasuryIcon },
  { key: "reports", label: "گزارش‌ها", icon: navReportsIcon },
  { key: "system", label: "مدیریت سیستم", icon: navSystemIcon },
] as const;

const densityOptions: Array<{ value: DisplayDensity; label: string }> = [
  { value: "compact", label: "فشرده" },
  { value: "comfortable", label: "استاندارد" },
  { value: "spacious", label: "بزرگ" },
];

function sectionForItem(item: NavigationItem): string {
  if (item.path === "/dashboard") return "dashboard";
  if (item.path.startsWith("/approval/")) return "system";
  if (item.path.startsWith("/audit/")) return "reports";
  if (item.path.includes("/reports") || item.label.startsWith("گزارش")) return "reports";
  if (item.group === "اطلاعات پایه") return "base";
  if (item.group === "مدیریت مالی") return "finance";
  if (item.group === "حسابداری") return "accounting";
  if (item.group === "انبار و موجودی") return "inventory";
  if (item.group === "خرید و تدارکات") return "purchases";
  if (item.group === "فروش") return "sales";
  return "system";
}

function pageTitle(pathname: string, items: readonly NavigationItem[]): { label: string; group: string } {
  const item = [...items]
    .sort((first, second) => second.path.length - first.path.length)
    .find((candidate) => pathname === candidate.path || pathname.startsWith(`${candidate.path}/`));
  if (!item) return { label: "آرگین", group: "اصلی" };
  const section = sectionDefinitions.find((definition) => definition.key === sectionForItem(item));
  return { label: item.label, group: section?.label ?? "اصلی" };
}

function navigationSectionForPath(pathname: string): string | null {
  const item = [...navigationItems]
    .sort((first, second) => second.path.length - first.path.length)
    .find((candidate) => pathname === candidate.path || pathname.startsWith(`${candidate.path}/`));
  const sectionKey = item ? sectionForItem(item) : null;
  return sectionKey && sectionKey !== "dashboard" ? sectionKey : null;
}

function navigationClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? "app-shell__nav-link app-shell__nav-link--active" : "app-shell__nav-link";
}

export function AppShell() {
  const { pathname } = useLocation();
  const { session, clearSession } = useAuthSession();
  const context = useActiveContext();
  const { density, setDensity } = useDisplayDensity();
  const [expandedSection, setExpandedSection] = useState<string | null>(() => navigationSectionForPath(pathname));
  const [navigationSearch, setNavigationSearch] = useState("");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedProfileAction, setSelectedProfileAction] = useState<"display" | null>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLElement>(null);
  const profileCloseTimer = useRef<number | undefined>(undefined);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const settingsPopoverRef = useRef<HTMLElement>(null);
  const settingsCloseTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (profileCloseTimer.current !== undefined) window.clearTimeout(profileCloseTimer.current);
    if (settingsCloseTimer.current !== undefined) window.clearTimeout(settingsCloseTimer.current);
  }, []);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    function handleOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (profileTriggerRef.current?.contains(target) || profileMenuRef.current?.contains(target)) return;
      setIsProfileMenuOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
        profileTriggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isProfileMenuOpen]);

  function cancelProfileClose(): void {
    if (profileCloseTimer.current !== undefined) {
      window.clearTimeout(profileCloseTimer.current);
      profileCloseTimer.current = undefined;
    }
  }

  function scheduleProfileClose(): void {
    cancelProfileClose();
    profileCloseTimer.current = window.setTimeout(() => setIsProfileMenuOpen(false), 220);
  }

  function cancelSettingsClose(): void {
    if (settingsCloseTimer.current !== undefined) {
      window.clearTimeout(settingsCloseTimer.current);
      settingsCloseTimer.current = undefined;
    }
  }

  function scheduleSettingsClose(): void {
    cancelSettingsClose();
    settingsCloseTimer.current = window.setTimeout(() => setIsSettingsOpen(false), 220);
  }

  const permissions = useMemo(() => new Set(session?.user.permissions ?? []), [session]);
  const visibleItems = useMemo(
    () => navigationItems.filter((item) => {
      if (permissions.has("system.full-access")) return true;
      if (item.requiredPermission && !permissions.has(item.requiredPermission)) return false;
      if (item.requiredAnyPermissions && !item.requiredAnyPermissions.some((permission) => permissions.has(permission))) return false;
      return true;
    }),
    [permissions],
  );
  const query = navigationSearch.trim().toLocaleLowerCase();
  const filteredItems = useMemo(
    () => query ? visibleItems.filter((item) => item.label.toLocaleLowerCase().includes(query)) : visibleItems,
    [query, visibleItems],
  );
  const title = pageTitle(pathname, visibleItems);
  const accountName = session?.user.displayName || session?.user.username || "حکمت";
  useEffect(() => {
    setExpandedSection(navigationSectionForPath(pathname));
  }, [pathname]);

  const sections: NavigationSection[] = sectionDefinitions
    .filter((section) => section.key !== "treasury")
    .map((section) => ({
      ...section,
      items: filteredItems.filter((item) => sectionForItem(item) === section.key),
    }));
  const hasTreasury = filteredItems.some((item) => sectionForItem(item) === "treasury");
  if (!query || hasTreasury) {
    sections.splice(7, 0, {
      key: "treasury",
      label: "خزانه‌داری",
      icon: navTreasuryIcon,
      items: filteredItems.filter((item) => sectionForItem(item) === "treasury"),
    });
  }

  function toggleSection(key: string): void {
    setExpandedSection((current) => current === key ? null : key);
  }

  function renderSectionLinks(items: readonly NavigationItem[]) {
    return items.map((item) => (
      <NavLink key={item.path} to={item.path} className={navigationClassName}>
        <span>{item.label}</span>
      </NavLink>
    ));
  }

  return (
    <div className="app-shell" dir="rtl">
      <a className="app-shell__skip-link" href="#app-main-content">پرش به محتوای اصلی</a>
      <aside className="app-shell__sidebar" aria-label="نوار کناری برنامه">
        <div className="app-shell__brand" aria-label="حسابداری آرگین">
          <img className="app-shell__brand-contour" src={brandContour} alt="" aria-hidden="true" />
          <span className="app-shell__brand-medallion"><img src={logoMedallion} alt="" aria-hidden="true" /></span>
          <img className="app-shell__brand-logo" src={officialArginLogo} alt="" aria-hidden="true" />
          <div className="app-shell__brand-copy">
            <span>نرم‌افزار</span>
            <strong>حسابداری آرگین</strong>
          </div>
        </div>

        <nav className="app-shell__nav" aria-label="ناوبری اصلی">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? "app-shell__dashboard-link app-shell__dashboard-link--active" : "app-shell__dashboard-link"}>
            <img className="app-shell__menu-capsule" src={activeNavigation} alt="" aria-hidden="true" />
            <img className="app-shell__active-indicator" src={activeIndicator} alt="" aria-hidden="true" />
            <span className="app-shell__nav-chevron"><img src={chevronBackground} alt="" aria-hidden="true" /><img className="app-shell__chevron-glyph" src={activeNavChevron} alt="" aria-hidden="true" /></span>
            <span className="app-shell__nav-label">داشبورد</span>
            <span className="app-shell__nav-icon-backdrop"><img src={activeIconBackdrop} alt="" aria-hidden="true" /><img className="app-shell__dashboard-icon" src={navDashboardIcon} alt="" aria-hidden="true" /></span>
          </NavLink>

          {sections.map((section) => {
            const expanded = query.length > 0 || expandedSection === section.key;
            return (
              <section key={section.key} className="app-shell__nav-section">
                <button
                  type="button"
                  className="app-shell__section-toggle"
                  aria-expanded={expanded}
                  aria-controls={`app-shell-nav-${section.key}`}
                  onClick={() => toggleSection(section.key)}
                >
                  <img className="app-shell__menu-capsule" src={menuCapsule} alt="" aria-hidden="true" />
                  <span className="app-shell__nav-chevron"><img src={chevronBackground} alt="" aria-hidden="true" /><img className="app-shell__chevron-glyph" src={navChevron} alt="" aria-hidden="true" /></span>
                  <span className="app-shell__nav-label">{section.label}</span>
                  <span className="app-shell__nav-icon-backdrop"><img src={iconBackground} alt="" aria-hidden="true" /><img className="app-shell__section-icon" src={section.icon} alt="" aria-hidden="true" /></span>
                </button>
                <div
                  id={`app-shell-nav-${section.key}`}
                  className={`app-shell__section-items${expanded ? " app-shell__section-items--expanded" : ""}`}
                  aria-hidden={!expanded}
                  inert={!expanded}
                >
                  <div className="app-shell__section-items-inner">{renderSectionLinks(section.items)}</div>
                </div>
              </section>
            );
          })}
        </nav>
      </aside>

      <div className="app-shell__workspace">
        <header className="app-shell__topbar">
          <div className="app-shell__topbar-row">
            <div className="app-shell__title-block">
              <div className="app-shell__breadcrumb" aria-label="مسیر صفحه">آرگین / {title.group}</div>
              <h1 className="app-shell__page-title">{title.label}</h1>
            </div>
            <div className="app-shell__topbar-tools">
              <button
                ref={profileTriggerRef}
                className="app-shell__profile-trigger"
                type="button"
                aria-label={`نمایش حساب ${accountName}`}
                aria-expanded={isProfileMenuOpen}
                aria-controls="app-shell-profile-menu"
                onClick={() => {
                  cancelProfileClose();
                  setIsProfileMenuOpen((current) => !current);
                }}
                onMouseEnter={cancelProfileClose}
                onMouseLeave={scheduleProfileClose}
              >
                <img className="app-shell__profile-chevron-bg" src={chevronBackground} alt="" aria-hidden="true" />
                <img className="app-shell__profile-chevron" src={profileChevron} alt="" aria-hidden="true" />
                <span className="app-shell__profile-trigger-copy"><strong>{accountName}</strong><small>مدیر سیستم</small></span>
                <img className="app-shell__profile-avatar" src={accountAvatar} alt="" aria-hidden="true" />
              </button>

              <button className="app-shell__notification" type="button" aria-label="اعلان‌ها">
                <img src={notificationBell} alt="" aria-hidden="true" />
                <img className="app-shell__notification-unread" src={notificationUnread} alt="" aria-hidden="true" />
              </button>

              <label className="app-shell__utility-search">
                <img src={searchIcon} alt="" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="جست‌وجو در منو"
                  placeholder="جست‌وجو در برنامه ..."
                  value={navigationSearch}
                  onChange={(event) => setNavigationSearch(event.target.value)}
                />
              </label>
            </div>
          </div>
        </header>

        <main id="app-main-content" className="app-shell__main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <div className="app-shell__floating-ui">
        <section
          ref={profileMenuRef}
          id="app-shell-profile-menu"
          className={`app-shell__profile-menu${isProfileMenuOpen ? " app-shell__profile-menu--open" : ""}`}
          aria-label="منوی حساب کاربری"
          aria-hidden={!isProfileMenuOpen}
          onMouseEnter={cancelProfileClose}
          onMouseLeave={scheduleProfileClose}
        >
          <div className="app-shell__account-menu">
            <nav className="app-shell__profile-actions" aria-label="گزینه‌های حساب کاربری">
              <NavLink
                to="/dashboard"
                className={({ isActive }) => `app-shell__profile-action${isActive ? " app-shell__profile-action--selected" : ""}`}
                onClick={() => {
                  setSelectedProfileAction(null);
                  setIsProfileMenuOpen(false);
                }}
              >
                <img src={navDashboardIcon} alt="" aria-hidden="true" />
                <span>داشبورد</span>
              </NavLink>
              <button
                className={`app-shell__profile-action${selectedProfileAction === "display" ? " app-shell__profile-action--selected" : ""}`}
                type="button"
                aria-pressed={selectedProfileAction === "display"}
                onClick={() => {
                  setSelectedProfileAction("display");
                  setIsSettingsOpen(true);
                  setIsProfileMenuOpen(false);
                }}
              >
                <img src={settingsGear} alt="" aria-hidden="true" />
                <span>تنظیمات نمایش</span>
              </button>
            </nav>
            <div className="app-shell__profile-divider" role="separator" />
            <button className="app-shell__logout" type="button" onClick={clearSession}>
              <span>خروج</span>
              <svg className="app-shell__power-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2.5v9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M6.35 5.85a8.25 8.25 0 1 0 11.3 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </section>

        <section
          ref={settingsPopoverRef}
          id="app-shell-settings-popover"
          className={`app-shell__settings${isSettingsOpen ? " app-shell__settings--open" : ""}`}
          aria-label="تنظیمات نمایش و زمینه فعال"
          aria-hidden={!isSettingsOpen}
          onMouseEnter={cancelSettingsClose}
          onMouseLeave={scheduleSettingsClose}
          onFocusCapture={cancelSettingsClose}
          onBlurCapture={(event) => {
            if (event.relatedTarget instanceof Node && (settingsPopoverRef.current?.contains(event.relatedTarget) || settingsTriggerRef.current?.contains(event.relatedTarget))) return;
            scheduleSettingsClose();
          }}
        >
          <label className="app-shell__setting-row">
            <span className="app-shell__setting-select">
              <select value={context.fiscalYearId} disabled={context.isLoading || context.fiscalYears.length === 0} onChange={(event) => context.setFiscalYearId(event.target.value)}>
                {context.fiscalYears.length === 0 && <option value="">سال مالی موجود نیست</option>}
                {context.fiscalYears.map((year) => <option key={year.id} value={year.id}>{year.title}{year.isCurrent ? " – جاری" : ""}</option>)}
              </select>
              <img src={settingsChevron} alt="" aria-hidden="true" />
            </span>
            <strong>سال مالی فعال</strong>
          </label>
          <label className="app-shell__setting-row">
            <span className="app-shell__setting-select">
              <select value={context.branchId} disabled={!context.companyId || context.branches.length === 0} onChange={(event) => context.setBranchId(event.target.value)}>
                {context.branches.length === 0 && <option value="">شعبه‌ای موجود نیست</option>}
                {context.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
              <img src={settingsChevron} alt="" aria-hidden="true" />
            </span>
            <strong>شعبه فعال</strong>
          </label>
          <label className="app-shell__setting-row">
            <span className="app-shell__setting-select">
              <select value={density} onChange={(event) => setDensity(event.target.value as DisplayDensity)}>
                {densityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <img src={settingsChevron} alt="" aria-hidden="true" />
            </span>
            <strong>تراکم نمایش</strong>
          </label>
        </section>
        <button
          ref={settingsTriggerRef}
          className="app-shell__settings-trigger"
          type="button"
          aria-label="تنظیمات نمایش"
          aria-expanded={isSettingsOpen}
          aria-controls="app-shell-settings-popover"
          onMouseEnter={() => {
            cancelSettingsClose();
            setIsSettingsOpen(true);
          }}
          onMouseLeave={scheduleSettingsClose}
          onFocus={() => {
            cancelSettingsClose();
            setIsSettingsOpen(true);
          }}
          onBlur={(event) => {
            if (event.relatedTarget instanceof Node && (settingsPopoverRef.current?.contains(event.relatedTarget) || settingsTriggerRef.current?.contains(event.relatedTarget))) return;
            scheduleSettingsClose();
          }}
          onClick={() => setIsSettingsOpen(true)}
        >
          <img src={settingsGear} alt="" aria-hidden="true" />
        </button>
      </div>
      {context.error && pathname !== "/dashboard" ? <div className="app-shell__global-context-error"><Feedback tone="error">{context.error}</Feedback></div> : null}
    </div>
  );
}
