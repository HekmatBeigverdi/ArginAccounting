import {
  SecurityBootstrapProvider
} from "./app/providers/security-bootstrap-provider";

import {
  AppRouter
} from "./app/router/app-router";

import "./App.css";

function App() {
  return (
    <SecurityBootstrapProvider>
      <AppRouter />
    </SecurityBootstrapProvider>
  );
}

export default App;
