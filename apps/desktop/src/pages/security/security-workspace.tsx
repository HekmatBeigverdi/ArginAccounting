import type { PropsWithChildren, ReactNode } from "react";
import { NavLink } from "react-router";

import { Page } from "../../components/layout";

import "./security-workspace.css";

interface SecurityWorkspaceProps extends PropsWithChildren {
  title: string;
  description: string;
  actions?: ReactNode;
}

const tabs = [
  { path: "/security/users", label: "کاربران" },
  { path: "/security/roles", label: "نقش‌ها" },
  { path: "/security/permissions", label: "مجوزها" },
] as const;

export function SecurityWorkspace({
  title,
  description,
  actions,
  children,
}: SecurityWorkspaceProps) {
  return (
    <Page className="security-workspace">
      <header className="security-workspace__header">
        <div>
          <p className="security-workspace__eyebrow">مدیریت سیستم / امنیت و دسترسی</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {actions ? <div className="security-workspace__actions">{actions}</div> : null}
      </header>

      <nav className="security-workspace__tabs" aria-label="بخش‌های امنیت و دسترسی">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              isActive
                ? "security-workspace__tab security-workspace__tab--active"
                : "security-workspace__tab"
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="security-workspace__content">{children}</div>
    </Page>
  );
}
