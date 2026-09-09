import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("inventory quantity reports are routed and permission gated", async () => {
  const [router, navigation, composition] = await Promise.all([
    read("src/app/router/app-router.tsx"),
    read("src/app/navigation/navigation-items.ts"),
    read("src/composition/inventory/create-inventory-report-services.ts"),
  ]);
  assert.match(router, /\/inventory\/reports/);
  assert.match(navigation, /گزارش‌های موجودی/);
  assert.match(navigation, /inventory\.documents\.view/);
  assert.match(composition, /requireBranch/);
  assert.match(composition, /branchId/);
});

test("quantity reports explain chronology, on-hand semantics and exact LTR display", async () => {
  const page = await read("src/pages/inventory/inventory-quantity-reports-page.tsx");
  assert.match(page, /تاریخ عملیات ← ترتیب روز ← شناسه سند ← شناسه ردیف ← شناسه movement/);
  assert.match(page, /On-hand/);
  assert.match(page, /Available-to-Promise/);
  assert.match(page, /dir="ltr"/);
  assert.doesNotMatch(page, /Number\(row\.quantity\)/);
});

test("source drill-down resolves durable document and line identities", async () => {
  const page = await read("src/pages/inventory/inventory-quantity-reports-page.tsx");
  assert.match(page, /entry\.source\.documentId/);
  assert.match(page, /entry\.source\.lineId/);
  assert.match(page, /sourceLineId/);
  assert.match(page, /durable/);
});

test("Step 17 does not add valuation or print export actions", async () => {
  const page = await read("src/pages/inventory/inventory-quantity-reports-page.tsx");
  assert.match(page, /بدون ارزش‌گذاری ریالی/);
  assert.doesNotMatch(page, /چاپ|PDF|Excel|XLSX|CSV/);
});
