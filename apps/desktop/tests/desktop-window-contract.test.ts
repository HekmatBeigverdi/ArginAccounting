import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync(
  new URL("../src-tauri/tauri.conf.json", import.meta.url),
  "utf8"
)) as {
  productName?: string;
  app?: { windows?: Array<{ title?: string; width?: number; height?: number; decorations?: boolean }> };
};

const capability = JSON.parse(readFileSync(
  new URL("../src-tauri/capabilities/default.json", import.meta.url),
  "utf8"
)) as {
  permissions?: string[];
};

const titleBar = readFileSync(
  new URL("../src/components/desktop/desktop-title-bar.tsx", import.meta.url),
  "utf8"
);

test("desktop starts at the Phase 14 baseline window size", () => {
  const window = config.app?.windows?.[0];
  assert.equal(window?.width, 1366);
  assert.equal(window?.height, 768);
});

test("desktop uses the Argin custom frameless window chrome", () => {
  const window = config.app?.windows?.[0];
  assert.equal(config.productName, "ArginAccounting");
  assert.equal(window?.title, "ArginAccounting");
  assert.equal(window?.decorations, false);
  assert.match(titleBar, /data-tauri-drag-region/u);
  assert.match(titleBar, /\.minimize\(\)/u);
  assert.match(titleBar, /\.toggleMaximize\(\)/u);
  assert.match(titleBar, /\.close\(\)/u);
});

test("desktop capability grants only the required custom-window actions", () => {
  const permissions = new Set(capability.permissions ?? []);
  assert.equal(permissions.has("core:window:allow-close"), true);
  assert.equal(permissions.has("core:window:allow-minimize"), true);
  assert.equal(permissions.has("core:window:allow-toggle-maximize"), true);
  assert.equal(permissions.has("core:window:allow-start-dragging"), true);
});
