import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCodingTemplateAccountTree,
  codingTemplateErrorDetails,
  codingTemplateIssueAction,
  codingTemplateErrorMessage,
  codingTemplateIssueMessage,
  codingTemplateLabel,
  formatJalaliDate,
} from "../src/features/accounting/coding-templates-presenter.ts";
import { createCodingTemplatePreview, IRAN_SERVICE_CODING_CATALOG } from "@argin/accounting";

test("coding template labels are Persian and presentation-only", () => {
  assert.equal(codingTemplateLabel("manufacturing"), "تولیدی");
  assert.equal(codingTemplateLabel("published"), "منتشرشده");
  assert.equal(codingTemplateLabel("future-value"), "future-value");
});

test("preview issues have actionable Persian messages", () => {
  assert.match(codingTemplateIssueMessage("code_conflict"), /کد/);
  assert.match(codingTemplateIssueMessage("hierarchy_conflict"), /والد و فرزند/);
  assert.match(codingTemplateErrorMessage(new Error("stale_preview")), /دوباره پیش‌نمایش/);
  assert.match(codingTemplateIssueAction({ code: "code_conflict", itemType: "account", logicalKey: "cash", conflictingId: "1", field: "code" }), /کدینگ حساب‌ها/);
});

test("coding template failures expose separate user and technical messages", () => {
  const sqlite = new Error("CHECK constraint failed: coding_template_applications");
  const database = new Error("Failed to execute SQLite statement", { cause: sqlite });
  Object.assign(database, { code: "QUERY_FAILED" });

  const details = codingTemplateErrorDetails(database);

  assert.match(details.summary, /عملیات الگوی کدینگ انجام نشد/);
  assert.match(details.technical, /QUERY_FAILED/);
  assert.match(details.technical, /coding_template_applications/);
});

test("preview accounts are presented as an ordered hierarchy with plan status", () => {
  const content = IRAN_SERVICE_CODING_CATALOG.content;
  const preview = createCodingTemplatePreview({
    companyId: "company-1",
    templateVersionId: "version-1",
    content,
    baseline: { companyId: "company-1", accounts: [], dimensionTypes: [], dimensionMembers: [], accountDimensionPolicies: [] },
  });
  const tree = buildCodingTemplateAccountTree(content.accounts, preview);
  assert.ok(tree.length > 0);
  assert.equal(tree[0]?.account.parentLogicalKey, null);
  assert.equal(tree[0]?.action, "create");
  assert.ok((tree[0]?.children.length ?? 0) > 0);
  assert.equal(tree[0]?.children[0]?.account.parentLogicalKey, tree[0]?.account.logicalKey);
});

test("ISO timestamps are displayed with the Solar Hijri calendar", () => {
  const value = formatJalaliDate("2026-03-21T08:30:00.000Z");
  assert.match(value, /۱۴۰۵/);
  assert.equal(formatJalaliDate(null), "—");
});
