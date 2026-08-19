import {
  AuthSessionProvider
} from "./app/providers/auth-session-provider";

import {
  SecurityBootstrapProvider
} from "./app/providers/security-bootstrap-provider";

import {
  AppRouter
} from "./app/router/app-router";

import {
  AuditProvider
} from "./composition/audit";

import {
  AccountingProvider
} from "./composition/accounting/accounting-provider";

import {
  PlatformProvider
} from "./platform";

import "./styles/design-tokens.css";
import "./components/ui.css";
import "./App.css";

function App() {
  return (
    <PlatformProvider>
      <SecurityBootstrapProvider>
        <AuthSessionProvider>
          <AuditProvider>
            <AccountingProvider>
              <AppRouter />
            </AccountingProvider>
          </AuditProvider>
        </AuthSessionProvider>
      </SecurityBootstrapProvider>
    </PlatformProvider>
  );
}

export default App;
