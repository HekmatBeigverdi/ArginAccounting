import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createAccountingReportExportDocument,
  createAccountingReportPrintHtml,
  createAccountingReportSpreadsheetXml,
} from "../src/features/accounting/accounting-report-export.ts";

const compositionPath = new URL(
  "../src/composition/accounting/create-accounting-report-services.ts",
  import.meta.url,
);
const pagePath = new URL(
  "../src/pages/accounting/accounting-reports-page.tsx",
  import.meta.url,
);
const exportPath = new URL(
  "../src/features/accounting/accounting-report-export.ts",
  import.meta.url,
);

const trialBalance = Object.freeze({
  mode: 6 as const,
  rows: Object.freeze([
    Object.freeze({
      accountId: "account-1",
      accountCode: "1101",
      accountName: "بانک",
      level: "subsidiary" as const,
      postingAllowed: true,
      openingDebit: 100,
      openingCredit: 0,
      periodDebit: 250,
      periodCredit: 50,
      endingDebit: 300,
      endingCredit: 0,
    }),
  ]),
  totals: Object.freeze({
    openingDebit: 100,
    openingCredit: 0,
    periodDebit: 250,
    periodCredit: 50,
    endingDebit: 300,
    endingCredit: 0,
  }),
  isBalanced: false,
});

test("export document projects canonical trial-balance DTO values without recalculation", () => {
  const document = createAccountingReportExportDocument({
    kind: "trial",
    data: trialBalance,
    companyName: "شرکت آرگین",
    fiscalYearTitle: "سال مالی ۱۴۰۵",
    branchLabel: "دفتر مرکزی",
    fromDate: "2026-03-21",
    toDate: "2027-03-20",
    generatedAt: new Date("2026-08-27T20:00:00.000Z"),
  });

  assert.equal(document.title, "تراز آزمایشی");
  assert.equal(document.sections[0]?.rows[0]?.[4], 250);
  assert.equal(document.sections[0]?.footer?.[6], 300);
  assert.match(document.periodLabel, /۱۴۰۵/);
});

test("SpreadsheetML export is Excel-compatible UTF-8 and right-to-left", () => {
  const document = createAccountingReportExportDocument({
    kind: "trial",
    data: trialBalance,
    companyName: "شرکت آرگین",
    fiscalYearTitle: "۱۴۰۵",
    branchLabel: "دفتر مرکزی",
    fromDate: "2026-03-21",
    toDate: "2027-03-20",
  });
  const xml = createAccountingReportSpreadsheetXml(document);

  assert.match(xml, /Excel\.Sheet/);
  assert.match(xml, /DisplayRightToLeft/);
  assert.match(xml, /شرکت آرگین/);
  assert.match(xml, /ss:Type="Number">250</);
});

test("print document is Persian RTL A4", () => {
  const document = createAccountingReportExportDocument({
    kind: "trial",
    data: trialBalance,
    companyName: "شرکت آرگین",
    fiscalYearTitle: "۱۴۰۵",
    branchLabel: "دفتر مرکزی",
    fromDate: "2026-03-21",
    toDate: "2027-03-20",
  });
  const html = createAccountingReportPrintHtml(document);

  assert.match(html, /lang="fa" dir="rtl"/);
  assert.match(html, /@page\{size:A4 landscape/);
  assert.match(html, /شرکت آرگین/);
});

test("desktop print preview is in-webview and does not depend on popup windows", async () => {
  const source = await readFile(exportPath, "utf8");

  assert.doesNotMatch(source, /window\.open\(/);
  assert.match(source, /createElement\("iframe"\)/);
  assert.match(source, /frame\.srcdoc = createAccountingReportPrintHtml/);
  assert.match(source, /target\.print\(\)/);
  assert.match(source, /چاپ \/ ذخیره PDF/);
});

test("desktop export stays behind application export authorization", async () => {
  const [composition, page] = await Promise.all([
    readFile(compositionPath, "utf8"),
    readFile(pagePath, "utf8"),
  ]);

  assert.match(composition, /assertAccountingReportExportAuthorized/);
  assert.match(composition, /authorizeExport/);
  assert.match(page, /await desktopServices\.authorizeExport\(executed\.query\)/);
  assert.match(page, /accountingReportPermissions\.export/);
  assert.match(page, /downloadAccountingReportExcel/);
  assert.match(page, /openAccountingReportPrintPreview/);
});
