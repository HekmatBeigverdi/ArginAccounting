import assert from "node:assert/strict";
import test from "node:test";
import {
  codingTemplateErrorMessage,
  codingTemplateIssueMessage,
  codingTemplateLabel,
  formatJalaliDate,
} from "../src/features/accounting/coding-templates-presenter.ts";

test("coding template labels are Persian and presentation-only", () => {
  assert.equal(codingTemplateLabel("manufacturing"), "تولیدی");
  assert.equal(codingTemplateLabel("published"), "منتشرشده");
  assert.equal(codingTemplateLabel("future-value"), "future-value");
});

test("preview issues have actionable Persian messages", () => {
  assert.match(codingTemplateIssueMessage("code_conflict"), /کد/);
  assert.match(codingTemplateIssueMessage("hierarchy_conflict"), /والد و فرزند/);
  assert.match(codingTemplateErrorMessage(new Error("stale_preview")), /دوباره پیش‌نمایش/);
});

test("ISO timestamps are displayed with the Solar Hijri calendar", () => {
  const value = formatJalaliDate("2026-03-21T08:30:00.000Z");
  assert.match(value, /۱۴۰۵/);
  assert.equal(formatJalaliDate(null), "—");
});
