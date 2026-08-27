import type { AccountingDimensionReportsResult } from "@argin/accounting/dimension-reports";
import type { GeneralLedgerResult } from "@argin/accounting/general-ledger";
import type { JournalReportResult } from "@argin/accounting/journal-report";
import type { SubsidiaryLedgerResult } from "@argin/accounting/subsidiary-ledger";
import type { TrialBalanceResult } from "@argin/accounting/trial-balance";

export type AccountingReportExportKind =
  | "trial"
  | "general"
  | "subsidiary"
  | "journal"
  | "dimensions";

export type AccountingReportExportData =
  | TrialBalanceResult
  | GeneralLedgerResult
  | SubsidiaryLedgerResult
  | JournalReportResult
  | AccountingDimensionReportsResult;

export type AccountingReportExportCell = string | number;

export interface AccountingReportExportColumn {
  readonly key: string;
  readonly label: string;
  readonly numeric?: boolean;
}

export interface AccountingReportExportSection {
  readonly title?: string;
  readonly note?: string;
  readonly columns: readonly AccountingReportExportColumn[];
  readonly rows: readonly (readonly AccountingReportExportCell[])[];
  readonly footer?: readonly AccountingReportExportCell[];
}

export interface AccountingReportExportDocument {
  readonly title: string;
  readonly fileStem: string;
  readonly companyName: string;
  readonly fiscalYearTitle: string;
  readonly branchLabel: string;
  readonly periodLabel: string;
  readonly generatedAtLabel: string;
  readonly sections: readonly AccountingReportExportSection[];
}

const previewId = "accounting-report-print-preview";
const printHostId = "accounting-report-print-host";
const printStyleId = "accounting-report-print-style";

export function createAccountingReportExportDocument(input: {
  readonly kind: AccountingReportExportKind;
  readonly data: AccountingReportExportData;
  readonly companyName: string;
  readonly fiscalYearTitle: string;
  readonly branchLabel: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly generatedAt?: Date;
}): AccountingReportExportDocument {
  const title = reportTitle(input.kind);
  return Object.freeze({
    title,
    fileStem: sanitizeFileStem(`${title}-${input.companyName}`),
    companyName: input.companyName,
    fiscalYearTitle: input.fiscalYearTitle,
    branchLabel: input.branchLabel,
    periodLabel: `${toSolar(input.fromDate)} تا ${toSolar(input.toDate)}`,
    generatedAtLabel: (input.generatedAt ?? new Date()).toLocaleString("fa-IR-u-ca-persian"),
    sections: Object.freeze(buildSections(input.kind, input.data)),
  });
}

export function createAccountingReportSpreadsheetXml(
  document: AccountingReportExportDocument,
): string {
  const rows: string[] = [];
  rows.push(xmlRow([document.title], "Title"));
  rows.push(xmlRow([`شرکت: ${document.companyName}`]));
  rows.push(xmlRow([`سال مالی: ${document.fiscalYearTitle}`]));
  rows.push(xmlRow([`شعبه: ${document.branchLabel}`]));
  rows.push(xmlRow([`دوره: ${document.periodLabel}`]));
  rows.push(xmlRow([`تاریخ تهیه: ${document.generatedAtLabel}`]));
  rows.push("<Row/>");

  document.sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) rows.push("<Row/>");
    if (section.title) rows.push(xmlRow([section.title], "Section"));
    if (section.note) rows.push(xmlRow([section.note]));
    rows.push(xmlRow(section.columns.map((column) => column.label), "Header"));
    for (const row of section.rows) rows.push(xmlRow(row));
    if (section.footer) rows.push(xmlRow(section.footer, "Footer"));
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Font ss:FontName="Vazirmatn" ss:Size="10"/></Style><Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14"/><Alignment ss:Horizontal="Right"/></Style><Style ss:ID="Section"><Font ss:Bold="1" ss:Size="11"/><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/></Style><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style><Style ss:ID="Footer"><Font ss:Bold="1"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="${escapeXml(document.title).slice(0, 31)}"><Table>${rows.join("")}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><DisplayRightToLeft/><FreezePanes/><FrozenNoSplit/><SplitHorizontal>7</SplitHorizontal><TopRowBottomPane>7</TopRowBottomPane></WorksheetOptions></Worksheet></Workbook>`;
}

export function downloadAccountingReportExcel(
  document: AccountingReportExportDocument,
): void {
  const blob = new Blob(["\uFEFF", createAccountingReportSpreadsheetXml(document)], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  downloadBlob(blob, `${document.fileStem}.xls`);
}

export function openAccountingReportPrintPreview(
  report: AccountingReportExportDocument,
  autoPrint = false,
): void {
  const document = globalThis.document;
  document.getElementById(previewId)?.remove();
  removePrintArtifacts(document);

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const overlay = document.createElement("div");
  overlay.id = previewId;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", `پیش‌نمایش ${report.title}`);
  overlay.tabIndex = -1;
  overlay.dir = "rtl";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100dvh",
    zIndex: "2147483647",
    display: "grid",
    gridTemplateRows: "56px minmax(0, 1fr)",
    overflow: "hidden",
    background: "#e2e8f0",
  });

  const toolbar = document.createElement("div");
  Object.assign(toolbar.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    borderBottom: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    fontFamily: "Vazirmatn, Tahoma, Arial, sans-serif",
    boxShadow: "0 1px 4px rgb(15 23 42 / 0.08)",
  });

  const title = document.createElement("strong");
  title.textContent = `پیش‌نمایش چاپ — ${report.title}`;
  title.style.marginInlineEnd = "auto";

  const printButton = createToolbarButton(document, "چاپ / ذخیره PDF");
  const closeButton = createToolbarButton(document, "بستن");

  const viewport = document.createElement("div");
  Object.assign(viewport.style, {
    minWidth: "0",
    minHeight: "0",
    overflow: "hidden",
    paddingBottom: "20px",
    background: "#e2e8f0",
  });

  const frame = document.createElement("iframe");
  frame.title = `پیش‌نمایش ${report.title}`;
  frame.srcdoc = createAccountingReportPrintHtml(report);
  Object.assign(frame.style, {
    display: "block",
    width: "100%",
    height: "100%",
    border: "0",
    background: "#ffffff",
  });

  const close = () => {
    removePrintArtifacts(document);
    overlay.remove();
    document.body.style.overflow = previousOverflow;
  };

  const print = () => printAccountingReportFromMainWebview(report);

  printButton.addEventListener("click", print);
  closeButton.addEventListener("click", close);
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  frame.addEventListener("load", () => {
    const frameDocument = frame.contentDocument;
    if (frameDocument) {
      frameDocument.documentElement.style.minHeight = "100%";
      frameDocument.body.style.minHeight = "100%";
      frameDocument.body.style.paddingBottom = "24mm";
      frameDocument.body.style.scrollPaddingBottom = "24mm";
    }
    if (autoPrint) globalThis.setTimeout(print, 100);
  });

  toolbar.append(title, printButton, closeButton);
  viewport.appendChild(frame);
  overlay.append(toolbar, viewport);
  document.body.appendChild(overlay);
  overlay.focus();
}

export function printAccountingReportFromMainWebview(
  report: AccountingReportExportDocument,
): void {
  const document = globalThis.document;
  removePrintArtifacts(document);

  const source = new DOMParser().parseFromString(
    createAccountingReportPrintHtml(report),
    "text/html",
  );

  const host = document.createElement("div");
  host.id = printHostId;
  host.dir = "rtl";
  host.lang = "fa";
  host.innerHTML = source.body.innerHTML;

  const style = document.createElement("style");
  style.id = printStyleId;
  style.textContent = `
    #${printHostId} { display: none; }
    @page { size: A4 landscape; margin: 10mm; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      body > *:not(#${printHostId}) { display: none !important; }
      body > #${printHostId} {
        display: block !important;
        color: #111827;
        background: #fff;
        font-family: Vazirmatn, Tahoma, Arial, sans-serif;
        font-size: 8.5pt;
        direction: rtl;
      }
      #${printHostId} header {
        display: grid;
        gap: 3mm;
        margin-bottom: 5mm;
        padding-bottom: 4mm;
        border-bottom: 1px solid #94a3b8;
      }
      #${printHostId} h1, #${printHostId} h2, #${printHostId} p { margin: 0; }
      #${printHostId} h1 { font-size: 16pt; }
      #${printHostId} h2 { margin: 5mm 0 2mm; font-size: 11pt; }
      #${printHostId} .meta { display: flex; flex-wrap: wrap; gap: 2mm 6mm; color: #475569; font-size: 8pt; }
      #${printHostId} .section-note { margin-bottom: 2mm; color: #64748b; }
      #${printHostId} table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
      #${printHostId} thead { display: table-header-group; }
      #${printHostId} tr { page-break-inside: avoid; page-break-after: auto; }
      #${printHostId} th, #${printHostId} td {
        padding: 1.6mm 2mm;
        border: 1px solid #cbd5e1;
        text-align: right;
        vertical-align: top;
      }
      #${printHostId} th { background: #f1f5f9; font-weight: 700; }
      #${printHostId} tfoot th { background: #f8fafc; }
      #${printHostId} .num {
        direction: ltr;
        text-align: left;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(host);

  const cleanup = () => removePrintArtifacts(document);
  globalThis.addEventListener("afterprint", cleanup, { once: true });
  globalThis.focus();
  globalThis.print();
}

export function createAccountingReportPrintHtml(
  document: AccountingReportExportDocument,
): string {
  const sections = document.sections.map((section) => {
    const heading = section.title ? `<h2>${escapeHtml(section.title)}</h2>` : "";
    const note = section.note ? `<p class="section-note">${escapeHtml(section.note)}</p>` : "";
    const head = `<tr>${section.columns.map((column) => `<th${column.numeric ? ' class="num"' : ""}>${escapeHtml(column.label)}</th>`).join("")}</tr>`;
    const body = section.rows.map((row) => `<tr>${row.map((cell, index) => `<td${section.columns[index]?.numeric ? ' class="num"' : ""}>${formatPrintCell(cell)}</td>`).join("")}</tr>`).join("");
    const foot = section.footer ? `<tfoot><tr>${section.footer.map((cell, index) => `<th${section.columns[index]?.numeric ? ' class="num"' : ""}>${formatPrintCell(cell)}</th>`).join("")}</tr></tfoot>` : "";
    return `<section>${heading}${note}<table><thead>${head}</thead><tbody>${body}</tbody>${foot}</table></section>`;
  }).join("");

  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(document.title)}</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}html{min-height:100%}body{min-height:100%;margin:0;padding:8mm 8mm 24mm;color:#111827;background:#fff;font-family:Vazirmatn,Tahoma,Arial,sans-serif;font-size:9pt;direction:rtl}header{display:grid;gap:3mm;margin-bottom:5mm;padding-bottom:4mm;border-bottom:1px solid #94a3b8}h1,h2,p{margin:0}h1{font-size:16pt}h2{margin:5mm 0 2mm;font-size:11pt}.meta{display:flex;flex-wrap:wrap;gap:2mm 6mm;color:#475569;font-size:8pt}.section-note{margin-bottom:2mm;color:#64748b}table{width:100%;border-collapse:collapse;page-break-inside:auto}thead{display:table-header-group}tr{page-break-inside:avoid;page-break-after:auto}th,td{padding:1.6mm 2mm;border:1px solid #cbd5e1;text-align:right;vertical-align:top}th{background:#f1f5f9;font-weight:700}tfoot th{background:#f8fafc}.num{direction:ltr;text-align:left;font-variant-numeric:tabular-nums;white-space:nowrap}@media print{body{min-height:auto;padding:0;font-size:8.5pt}}</style></head><body><header><h1>${escapeHtml(document.title)}</h1><div class="meta"><span>شرکت: ${escapeHtml(document.companyName)}</span><span>سال مالی: ${escapeHtml(document.fiscalYearTitle)}</span><span>شعبه: ${escapeHtml(document.branchLabel)}</span><span>دوره: ${escapeHtml(document.periodLabel)}</span><span>تاریخ تهیه: ${escapeHtml(document.generatedAtLabel)}</span></div></header>${sections}</body></html>`;
}

function buildSections(
  kind: AccountingReportExportKind,
  data: AccountingReportExportData,
): AccountingReportExportSection[] {
  switch (kind) {
    case "trial": {
      const result = data as TrialBalanceResult;
      return [Object.freeze({
        columns: columns([
          ["code", "کد حساب"], ["name", "حساب"], ["od", "افتتاحیه بدهکار", true], ["oc", "افتتاحیه بستانکار", true],
          ["pd", "گردش بدهکار", true], ["pc", "گردش بستانکار", true], ["ed", "مانده بدهکار", true], ["ec", "مانده بستانکار", true],
        ]),
        rows: Object.freeze(result.rows.map((row) => Object.freeze([row.accountCode, row.accountName, row.openingDebit, row.openingCredit, row.periodDebit, row.periodCredit, row.endingDebit, row.endingCredit]))),
        footer: Object.freeze(["", "جمع", result.totals.openingDebit, result.totals.openingCredit, result.totals.periodDebit, result.totals.periodCredit, result.totals.endingDebit, result.totals.endingCredit]),
      })];
    }
    case "general": {
      const result = data as GeneralLedgerResult;
      return result.sections.map((section) => Object.freeze({
        title: `${section.accountCode} — ${section.accountName}`,
        note: `مانده افتتاحیه: ${formatSigned(section.openingNet)} | مانده پایان: ${formatSigned(section.endingNet)}`,
        columns: columns([["date", "تاریخ"], ["voucher", "سند"], ["description", "شرح"], ["debit", "بدهکار", true], ["credit", "بستانکار", true], ["balance", "مانده", true]]),
        rows: Object.freeze(section.movements.map((row) => Object.freeze([toSolar(row.voucherDate), row.voucherNumber, row.description ?? "", row.debit, row.credit, formatSigned(row.runningNet)]))),
        footer: Object.freeze(["", "", "جمع گردش", section.periodDebit, section.periodCredit, formatSigned(section.endingNet)]),
      }));
    }
    case "subsidiary": {
      const result = data as SubsidiaryLedgerResult;
      return [Object.freeze({
        columns: columns([["code", "کد حساب"], ["name", "حساب معین"], ["opening", "افتتاحیه", true], ["debit", "بدهکار", true], ["credit", "بستانکار", true], ["ending", "مانده", true], ["count", "تعداد ردیف", true]]),
        rows: Object.freeze(result.accounts.map((section) => Object.freeze([section.accountCode, section.accountName, formatSigned(section.turnover.openingNet), section.turnover.periodDebit, section.turnover.periodCredit, formatSigned(section.turnover.endingNet), section.turnover.movementCount]))),
      })];
    }
    case "journal": {
      const result = data as JournalReportResult;
      return [Object.freeze({
        columns: columns([["date", "تاریخ"], ["voucher", "شماره سند"], ["code", "کد حساب"], ["name", "حساب"], ["description", "شرح"], ["dimensions", "ابعاد"], ["debit", "بدهکار", true], ["credit", "بستانکار", true]]),
        rows: Object.freeze(result.rows.map((row) => Object.freeze([toSolar(row.voucherDate), row.voucherNumber, row.accountCode, row.accountName, row.description ?? "", row.dimensions.map((item) => `${item.dimensionTypeId}:${item.memberId}`).join("، "), row.debit, row.credit]))),
        footer: Object.freeze(["", "", "", "", "", "جمع", result.totals.debit, result.totals.credit]),
      })];
    }
    case "dimensions": {
      const result = data as AccountingDimensionReportsResult;
      return [Object.freeze({
        columns: columns([["type", "نوع بُعد"], ["code", "کد عضو"], ["member", "عضو"], ["opening", "افتتاحیه", true], ["debit", "بدهکار", true], ["credit", "بستانکار", true], ["ending", "مانده", true]]),
        rows: Object.freeze(result.byMember.map((row) => Object.freeze([row.dimensionTypeName, row.memberCode, row.memberName, formatSigned(row.openingNet), row.periodDebit, row.periodCredit, formatSigned(row.endingNet)]))),
      })];
    }
  }
}

function reportTitle(kind: AccountingReportExportKind): string {
  switch (kind) {
    case "trial": return "تراز آزمایشی";
    case "general": return "دفتر کل";
    case "subsidiary": return "دفتر معین";
    case "journal": return "دفتر روزنامه";
    case "dimensions": return "گزارش ابعاد حسابداری";
  }
}

function columns(values: readonly (readonly [string, string, boolean?])[]): readonly AccountingReportExportColumn[] {
  return Object.freeze(values.map(([key, label, numeric]) => Object.freeze({ key, label, ...(numeric ? { numeric: true } : {}) })));
}

function xmlRow(cells: readonly AccountingReportExportCell[], style?: string): string {
  const styleAttribute = style ? ` ss:StyleID="${style}"` : "";
  return `<Row>${cells.map((cell) => `<Cell${styleAttribute}><Data ss:Type="${typeof cell === "number" ? "Number" : "String"}">${escapeXml(String(cell))}</Data></Cell>`).join("")}</Row>`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  globalThis.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function removePrintArtifacts(document: Document): void {
  document.getElementById(printHostId)?.remove();
  document.getElementById(printStyleId)?.remove();
}

function createToolbarButton(document: Document, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  Object.assign(button.style, {
    minHeight: "36px",
    border: "1px solid #94a3b8",
    borderRadius: "6px",
    background: "#ffffff",
    color: "#111827",
    padding: "6px 14px",
    font: "inherit",
    cursor: "pointer",
  });
  return button;
}

function formatPrintCell(value: AccountingReportExportCell): string {
  return typeof value === "number"
    ? new Intl.NumberFormat("fa-IR").format(value)
    : escapeHtml(value || "—");
}

function formatSigned(value: number): string {
  if (value === 0) return "—";
  return `${new Intl.NumberFormat("fa-IR").format(Math.abs(value))} ${value > 0 ? "بد" : "بس"}`;
}

function toSolar(value: string): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function sanitizeFileStem(value: string): string {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return normalized || "accounting-report";
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function escapeHtml(value: string): string {
  return escapeXml(value);
}
