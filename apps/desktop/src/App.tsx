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

import "./App.css";

function App() {
  return (
    <SecurityBootstrapProvider>
      <AuthSessionProvider>
        <AuditProvider>
          <AppRouter />
        </AuditProvider>
      </AuthSessionProvider>
    </SecurityBootstrapProvider>
  );
}

export default App;
