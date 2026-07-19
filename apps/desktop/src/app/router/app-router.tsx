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

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
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
            path="/company/setup"
            element={<CompanySetupPage />}
          />

          <Route
            path="/fiscal/years"
            element={<FiscalYearsPage />}
          />

          <Route
            path="/fiscal/years/new"
            element={<NewFiscalYearPage />}
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
