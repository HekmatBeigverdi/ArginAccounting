import {
  ActiveContextProvider
} from "./app/providers/active-context-provider";

import {
  AuthSessionProvider
} from "./app/providers/auth-session-provider";

import {
  DisplayDensityProvider
} from "./app/providers/display-density-provider";

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
import "./styles/persian-date-isolation.css";
import "./styles/accessibility.css";
import "./pages/product/products-page-tokens.css";

function App() {
  return (
    <PlatformProvider>
      <SecurityBootstrapProvider>
        <AuthSessionProvider>
          <AuditProvider>
            <AccountingProvider>
              <ActiveContextProvider>
                <DisplayDensityProvider>
                  <AppRouter />
                </DisplayDensityProvider>
              </ActiveContextProvider>
            </AccountingProvider>
          </AuditProvider>
        </AuthSessionProvider>
      </SecurityBootstrapProvider>
    </PlatformProvider>
  );
}

export default App;
