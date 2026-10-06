import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const appCss = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
const shellCss = await readFile(new URL("../src/app/shell/app-shell.css", import.meta.url), "utf8");

test("desktop shell fills the space below the title bar instead of scrolling the document", () => {
  assert.match(appCss, /html,[\s\S]*body,[\s\S]*#root[\s\S]*height:\s*100%/u);
  assert.match(appCss, /html,[\s\S]*body,[\s\S]*#root[\s\S]*overflow:\s*hidden/u);
  assert.match(appCss, /\.desktop-root\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/u);
  assert.match(appCss, /\.desktop-root__content\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*hidden/u);
  assert.match(shellCss, /\.app-shell\s*\{[^}]*height:\s*100%/u);
  assert.match(shellCss, /\.app-shell\s*\{[^}]*overflow-x:\s*clip;[^}]*overflow-y:\s*hidden/u);
});

test("header footer and user identity stay fixed while content regions scroll", () => {
  assert.match(shellCss, /\.app-shell__workspace\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto/u);
  assert.match(shellCss, /\.app-shell__workspace\s*\{[\s\S]*overflow:\s*hidden/u);
  assert.match(shellCss, /\.app-shell__main\s*\{[\s\S]*overflow-y:\s*auto/u);

  assert.match(shellCss, /\.app-shell__sidebar\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto/u);
  assert.match(shellCss, /\.app-shell__sidebar\s*\{[\s\S]*overflow:\s*hidden/u);
  assert.match(shellCss, /\.app-shell__nav\s*\{[\s\S]*overflow-y:\s*auto/u);
});

test("viewport lock does not break print output", () => {
  assert.match(appCss, /@media print[\s\S]*#root[\s\S]*height:\s*auto/u);
  assert.match(appCss, /@media print[\s\S]*overflow:\s*visible/u);
});
