import {
  HashRouter,
  Navigate,
  Route,
  Routes
} from "react-router";

import {
  TemporaryAppShell
} from "../shell/temporary-app-shell";

import {
  DashboardPage
} from "../../pages/dashboard/dashboard-page";

import {
  CompanySetupPage
} from "../../pages/company/company-setup-page";

import {
  FiscalYearsPage
} from "../../pages/fiscal/fiscal-years-page";

import {
  NewFiscalYearPage
} from "../../pages/fiscal/new-fiscal-year-page";

import {
  SystemDiagnosticsPage
} from "../../pages/system/system-diagnostics-page";

import {
  UsersPage
} from "../../pages/security/users-page";

import {
  RolesPage
} from "../../pages/security/roles-page";

import {
  PermissionsPage
} from "../../pages/security/permissions-page";

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route element={<TemporaryAppShell />}>
          <Route
            index
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          <Route
            path="/dashboard"
            element={<DashboardPage />}
          />

          <Route
            path="/security/users"
            element={<UsersPage />}
          />

          <Route
            path="/security/roles"
            element={<RolesPage />}
          />

          <Route
            path="/security/permissions"
            element={<PermissionsPage />}
          />

          <Route
            path="/company/setup"
            element={<CompanySetupPage />}
          />

          <Route
            path="/fiscal/years"
            element={<FiscalYearsPage />}
          />

          <Route
            path="/system/diagnostics"
            element={<SystemDiagnosticsPage />}
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}
