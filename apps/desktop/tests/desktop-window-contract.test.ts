import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync(
  new URL("../src-tauri/tauri.conf.json", import.meta.url),
  "utf8"
)) as {
  app?: { windows?: Array<{ width?: number; height?: number }> };
};

test("desktop starts at the Phase 14 baseline window size", () => {
  const window = config.app?.windows?.[0];
  assert.equal(window?.width, 1366);
  assert.equal(window?.height, 768);
});
