import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bridgePath = new URL(
  "../src/platform/install-native-print-bridge.ts",
  import.meta.url,
);
const mainPath = new URL("../src/main.tsx", import.meta.url);
const rustPath = new URL("../src-tauri/src/lib.rs", import.meta.url);

test("desktop print is bridged to the native Tauri webview print command", async () => {
  const [bridge, main, rust] = await Promise.all([
    readFile(bridgePath, "utf8"),
    readFile(mainPath, "utf8"),
    readFile(rustPath, "utf8"),
  ]);

  assert.match(bridge, /invoke\("print_current_webview"\)/);
  assert.match(bridge, /browserPrint\(\)/);
  assert.match(main, /installNativePrintBridge\(\)/);
  assert.match(rust, /fn print_current_webview\(webview: tauri::WebviewWindow\)/);
  assert.match(rust, /webview\.print\(\)/);
  assert.match(rust, /generate_handler!\[[\s\S]*print_current_webview/);
});
