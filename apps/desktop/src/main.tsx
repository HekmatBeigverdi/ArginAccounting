import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installNativePrintBridge } from "./platform/install-native-print-bridge";

installNativePrintBridge();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
