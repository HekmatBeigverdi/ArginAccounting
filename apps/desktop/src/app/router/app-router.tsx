import { HashRouter, Navigate, Route, Routes } from "react-router";

import { AppShell } from "../shell/app-shell";

import { DashboardPage } from "../../pages/dashboard/dashboard-page";
import { CompanySetupPage } from "../../pages/company/company-setup-page";
import { FiscalYearsPage } from "../../pages/fiscal/fiscal-years-page";
import { NewFiscalYearPage } from "../../pages/fiscal/new-fiscal-year-page";
import { SystemDiagnosticsPage } from "../../pages/system/system-diagnostics-page";
import { UsersPage } from "../../pages/security/users-page";
import { RolesPage } from "../../pages/security/roles-page";
import { PermissionsPage } from "../../pages/security/permissions-page";
import { LoginPage } from "../../pages/security/login-page";
import { ApprovalRequestsPage } from "../../pages/approval/approval-requests-page";
import { ApprovalRequestDetailsPage } from "../../pages/approval/approval-request-details-page";
import { AuditEntriesPage } from "../../pages/audit/audit-entries-page";
import { AuditEntryDetailsPage } from "../../pages/audit/audit-entry-details-page";
import { ChartOfAccountsPage } from "../../pages/accounting/chart-of-accounts-page";
import { AccountingDimensionsPage } from "../../pages/accounting/accounting-dimensions-page";
import { AccountingReportsPage } from "../../pages/accounting/accounting-reports-page";
import { CodingTemplatesPage } from "../../pages/accounting/coding-templates-page";
import { JournalVouchersRoute } from "../../pages/accounting/journal-vouchers-route";
import { PartiesPage } from "../../pages/party/parties-page";

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/security/users" element={<UsersPage />} />
          <Route path="/security/roles" element={<RolesPage />} />
          <Route path="/security/permissions" element={<PermissionsPage />} />
          <Route path="/company/setup" element={<CompanySetupPage />} />
          <Route path="/master-data/parties" element={<PartiesPage />} />
          <Route path="/fiscal/years" element={<FiscalYearsPage />} />
          <Route path="/fiscal/years/new" element={<NewFiscalYearPage />} />
          <Route path="/approval/requests" element={<ApprovalRequestsPage />} />
          <Route path="/approval/requests/:id" element={<ApprovalRequestDetailsPage />} />
          <Route path="/audit/entries" element={<AuditEntriesPage />} />
          <Route path="/audit/entries/:id" element={<AuditEntryDetailsPage />} />
          <Route path="/accounting/journal-vouchers" element={<JournalVouchersRoute />} />
          <Route path="/accounting/reports" element={<AccountingReportsPage />} />
          <Route path="/accounting/chart-of-accounts" element={<ChartOfAccountsPage />} />
          <Route path="/accounting/dimensions" element={<AccountingDimensionsPage />} />
          <Route path="/accounting/coding-templates" element={<CodingTemplatesPage />} />
          <Route path="/system/diagnostics" element={<SystemDiagnosticsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
