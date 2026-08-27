import { invoke } from "@tauri-apps/api/core";

export function installNativePrintBridge(): void {
  const browserPrint = globalThis.print.bind(globalThis);

  globalThis.print = () => {
    void invoke("print_current_webview").catch(() => {
      browserPrint();
    });
  };
}
