import {
  NavLink,
  Outlet
} from "react-router";

import {
  navigationItems
} from "../navigation/navigation-items";

function getNavigationClassName({
  isActive
}: {
  isActive: boolean;
}): string {
  return isActive
    ? "temporary-nav__link temporary-nav__link--active"
    : "temporary-nav__link";
}

export function TemporaryAppShell() {
  const groups = Array.from(
    new Set(
      navigationItems.map((item) => item.group)
    )
  );

  return (
    <div className="temporary-shell" dir="rtl">
      <aside className="temporary-sidebar">
        <div className="temporary-sidebar__brand">
          <strong>ArginAccounting</strong>
          <span>نسخه توسعه</span>
        </div>

        <nav className="temporary-nav">
          {groups.map((group) => (
            <section
              key={group}
              className="temporary-nav__group"
            >
              <h2>{group}</h2>

              {navigationItems
                .filter((item) => item.group === group)
                .map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={getNavigationClassName}
                  >
                    {item.label}
                  </NavLink>
                ))}
            </section>
          ))}
        </nav>
      </aside>

      <div className="temporary-shell__workspace">
        <header className="temporary-topbar">
          <div>
            <span>شرکت جاری:</span>
            <strong>انتخاب نشده</strong>
          </div>

          <div>
            <span>شعبه:</span>
            <strong>مرکزی</strong>
          </div>

          <div>
            <span>سال مالی:</span>
            <strong>انتخاب نشده</strong>
          </div>
        </header>

        <main className="temporary-main">
          <Outlet />
        </main>

        <footer className="temporary-statusbar">
          <span>حالت آفلاین</span>
          <span>SQLite</span>
          <span>ArginAccounting</span>
        </footer>
      </div>
    </div>
  );
}
