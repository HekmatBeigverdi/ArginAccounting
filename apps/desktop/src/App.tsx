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
  PlatformProvider
} from "./platform";

import "./App.css";

function App() {
  return (
    <PlatformProvider>
      <SecurityBootstrapProvider>
        <AuthSessionProvider>
          <AuditProvider>
            <AppRouter />
          </AuditProvider>
        </AuthSessionProvider>
      </SecurityBootstrapProvider>
    </PlatformProvider>
  );
}

export default App;
