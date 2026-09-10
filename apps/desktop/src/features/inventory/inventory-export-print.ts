import type {
  InventoryDocumentSnapshot,
  InventoryKardexReport,
  InventoryProductBalanceSummaryReport,
  InventoryQuantityBalanceReport,
} from "@argin/inventory";
import { createInventoryXlsx } from "@argin/inventory-tauri";
import { gregorianToJalali } from "../../pages/inventory/inventory-persian-date";

export type InventoryPrintOrientation = "portrait" | "landscape";

export interface InventoryPrintColumn {
  readonly label: string;
  readonly numeric?: boolean;
}

export interface InventoryPrintDocument {
  readonly title: string;
  readonly fileStem: string;
  readonly orientation: InventoryPrintOrientation;
  readonly metadata: readonly {
    readonly label: string;
    readonly value: string;
  }[];
  readonly columns: readonly InventoryPrintColumn[];
  readonly rows: readonly (readonly string[])[];
  readonly footer?: readonly string[];
}

const DOCUMENT_TYPE_LABELS: Record<
  InventoryDocumentSnapshot["documentType"],
  string
> = {
  receipt: "رسید انبار",
  issue: "حواله انبار",
  opening: "موجودی اول دوره",
  transfer: "انتقال بین انبارها",
  adjustment: "اصلاح مقدار",
};
const DOCUMENT_STATUS_LABELS: Record<
  InventoryDocumentSnapshot["status"],
  string
> = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  approved: "تأییدشده",
  confirmed: "قطعی",
  cancelled: "لغوشده",
  reversed: "برگشت‌شده",
};

export function createInventoryDocumentPrintModel(input: {
  readonly document: InventoryDocumentSnapshot;
  readonly companyName: string;
  readonly branchLabel: string;
  readonly productLabel?: (productId: string) => string;
  readonly locationLabel?: (lineId: string) => string;
}): InventoryPrintDocument {
  const document = input.document;
  return Object.freeze({
    title: DOCUMENT_TYPE_LABELS[document.documentType],
    fileStem: safeFileStem(
      `${DOCUMENT_TYPE_LABELS[document.documentType]}-${document.documentNumber ?? "draft"}`,
    ),
    orientation: "portrait",
    metadata: Object.freeze([
      { label: "شرکت", value: input.companyName },
      { label: "شعبه", value: input.branchLabel },
      { label: "شماره سند", value: document.documentNumber ?? "پیش‌نویس" },
      { label: "تاریخ", value: gregorianToJalali(document.businessDate) },
      { label: "وضعیت", value: DOCUMENT_STATUS_LABELS[document.status] },
      { label: "شرح", value: document.description ?? "—" },
    ]),
    columns: Object.freeze([
      { label: "ردیف", numeric: true },
      { label: "کالا" },
      { label: "مقدار", numeric: true },
      { label: "واحد" },
      { label: "محل نگهداری" },
      { label: "شرح" },
    ]),
    rows: Object.freeze(
      document.lines.map((line) =>
        Object.freeze([
          String(line.position),
          input.productLabel?.(line.productId) ?? line.productId,
          line.operation?.quantity.enteredQuantity ?? "—",
          line.operation?.quantity.enteredUnit.title ?? "—",
          input.locationLabel?.(line.lineId) ??
            line.operation?.warehouse.warehouseId ??
            "—",
          line.description ?? "—",
        ]),
      ),
    ),
  });
}

export function createInventoryBalancePrintModel(input: {
  readonly report: InventoryQuantityBalanceReport;
  readonly companyName: string;
  readonly scopeLabel: string;
}): InventoryPrintDocument {
  return Object.freeze({
    title: "صورت موجودی تعدادی کالا",
    fileStem: safeFileStem(`صورت-موجودی-${input.companyName}`),
    orientation: "landscape",
    metadata: Object.freeze([
      { label: "شرکت", value: input.companyName },
      { label: "محدوده", value: input.scopeLabel },
      {
        label: "تاریخ تهیه",
        value: new Date().toLocaleString("fa-IR-u-ca-persian"),
      },
    ]),
    columns: Object.freeze([
      { label: "کد کالا" },
      { label: "شرح کالا" },
      { label: "انبار" },
      { label: "ناحیه" },
      { label: "موقعیت" },
      { label: "موجودی پایه", numeric: true },
    ]),
    rows: Object.freeze(
      input.report.items.map((row) =>
        Object.freeze([
          row.productCode,
          row.productTitle,
          `${row.warehouseCode} — ${row.warehouseTitle}`,
          row.zoneTitle ?? "—",
          row.locationTitle ?? "—",
          row.quantity,
        ]),
      ),
    ),
  });
}

export function createInventorySummaryPrintModel(input: {
  readonly report: InventoryProductBalanceSummaryReport;
  readonly companyName: string;
  readonly scopeLabel: string;
}): InventoryPrintDocument {
  return Object.freeze({
    title: "خلاصه موجودی کالا",
    fileStem: safeFileStem(`خلاصه-موجودی-${input.companyName}`),
    orientation: "landscape",
    metadata: Object.freeze([
      { label: "شرکت", value: input.companyName },
      { label: "محدوده", value: input.scopeLabel },
      {
        label: "تاریخ تهیه",
        value: new Date().toLocaleString("fa-IR-u-ca-persian"),
      },
    ]),
    columns: Object.freeze([
      { label: "کد کالا" },
      { label: "شرح کالا" },
      { label: "موجودی کل", numeric: true },
      { label: "تعداد انبار", numeric: true },
      { label: "تعداد محل", numeric: true },
    ]),
    rows: Object.freeze(
      input.report.items.map((row) =>
        Object.freeze([
          row.productCode,
          row.productTitle,
          row.totalQuantity,
          String(row.warehouseCount),
          String(row.stockKeyCount),
        ]),
      ),
    ),
  });
}

export function createInventoryKardexPrintModel(input: {
  readonly report: InventoryKardexReport;
  readonly companyName: string;
  readonly scopeLabel: string;
  readonly productLabel: string;
  readonly warehouseLabel: string;
}): InventoryPrintDocument {
  return Object.freeze({
    title: "کاردکس تعدادی کالا",
    fileStem: safeFileStem(`کاردکس-${input.productLabel}`),
    orientation: "landscape",
    metadata: Object.freeze([
      { label: "شرکت", value: input.companyName },
      { label: "محدوده", value: input.scopeLabel },
      { label: "کالا", value: input.productLabel },
      { label: "انبار", value: input.warehouseLabel },
      {
        label: "تاریخ تهیه",
        value: new Date().toLocaleString("fa-IR-u-ca-persian"),
      },
    ]),
    columns: Object.freeze([
      { label: "ردیف", numeric: true },
      { label: "تاریخ" },
      { label: "نوع سند" },
      { label: "شماره سند" },
      { label: "شرح" },
      { label: "وارده", numeric: true },
      { label: "صادره", numeric: true },
      { label: "مانده", numeric: true },
    ]),
    rows: Object.freeze(
      input.report.entries.map((entry, index) =>
        Object.freeze([
          String(index + 1),
          gregorianToJalali(entry.movement.businessDate),
          entry.source.documentType,
          entry.source.documentNumber ?? "—",
          entry.source.lineDescription ??
            entry.source.documentDescription ??
            "—",
          entry.incomingQuantity === "0" ? "—" : entry.incomingQuantity,
          entry.outgoingQuantity === "0" ? "—" : entry.outgoingQuantity,
          entry.runningQuantity,
        ]),
      ),
    ),
    footer: Object.freeze([
      "",
      "",
      "",
      "",
      "جمع صفحه",
      input.report.incomingQuantity,
      input.report.outgoingQuantity,
      input.report.closingQuantity,
    ]),
  });
}

export function downloadInventoryPrintModelXlsx(
  model: InventoryPrintDocument,
): void {
  const rows = model.rows.map((row) =>
    Object.fromEntries(
      model.columns.map((column, index) => [column.label, row[index] ?? ""]),
    ),
  );
  downloadBytes(
    createInventoryXlsx(rows, model.title),
    `${model.fileStem}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

export function downloadInventoryBytes(
  bytes: Uint8Array,
  fileName: string,
  mime: string,
): void {
  downloadBytes(bytes, fileName, mime);
}

export function openInventoryPrintPreview(model: InventoryPrintDocument): void {
  const document = globalThis.document;
  document.getElementById("inventory-print-preview")?.remove();
  cleanupPrintArtifacts(document);
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const overlay = document.createElement("div");
  overlay.id = "inventory-print-preview";
  overlay.dir = "rtl";
  overlay.tabIndex = -1;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
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
    background: "#fff",
    borderBottom: "1px solid #cbd5e1",
    fontFamily: "Vazirmatn,Tahoma,Arial,sans-serif",
  });
  const title = document.createElement("strong");
  title.textContent = `پیش‌نمایش چاپ — ${model.title}`;
  title.style.marginInlineEnd = "auto";
  const print = toolbarButton(document, "چاپ / ذخیره PDF");
  const close = toolbarButton(document, "بستن");

  const viewport = document.createElement("div");
  Object.assign(viewport.style, {
    minWidth: "0",
    minHeight: "0",
    overflow: "hidden",
    paddingBottom: "20px",
  });
  const frame = document.createElement("iframe");
  frame.title = `پیش‌نمایش ${model.title}`;
  frame.srcdoc = createInventoryPrintHtml(model);
  Object.assign(frame.style, {
    width: "100%",
    height: "100%",
    border: "0",
    display: "block",
    background: "#fff",
  });

  const dismiss = () => {
    cleanupPrintArtifacts(document);
    overlay.remove();
    document.body.style.overflow = previousOverflow;
  };
  print.addEventListener("click", () => printInventoryModel(model));
  close.addEventListener("click", dismiss);
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") dismiss();
  });
  frame.addEventListener("load", () => {
    if (frame.contentDocument) {
      frame.contentDocument.documentElement.style.minHeight = "100%";
      frame.contentDocument.body.style.paddingBottom = "24mm";
      frame.contentDocument.body.style.scrollPaddingBottom = "24mm";
    }
  });
  toolbar.append(title, print, close);
  viewport.append(frame);
  overlay.append(toolbar, viewport);
  document.body.append(overlay);
  overlay.focus();
}

export function createInventoryPrintHtml(
  model: InventoryPrintDocument,
): string {
  const headerCells = model.columns
    .map((column) => renderPrintCell("th", column.label, column.numeric))
    .join("");
  const bodyRows = model.rows
    .map((row) => `<tr>${renderPrintRow(row, model.columns, "td")}</tr>`)
    .join("");
  const footer = model.footer
    ? `<tfoot><tr>${renderPrintRow(model.footer, model.columns, "th")}</tr></tfoot>`
    : "";
  const metadata = model.metadata
    .map(
      (item) =>
        `<span><b>${escapeHtml(item.label)}:</b> ${escapeHtml(item.value)}</span>`,
    )
    .join("");
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(model.title)}</title>
<style>
@page{size:A4 ${model.orientation};margin:10mm}
* {
  box-sizing: border-box;
}
html {
  min-height: 100%;
}
body {
  min-height: 100%;
  margin: 0;
  padding: 8mm 8mm 24mm;
  background: #fff;
  color: #111827;
  font-family: Vazirmatn,Tahoma,Arial,sans-serif;
  font-size: 9pt;
  direction: rtl;
}
header {
  display: grid;
  gap: 3mm;
  margin-bottom: 5mm;
  padding-bottom: 4mm;
  border-bottom: 1px solid #94a3b8;
}
h1 {
  margin: 0;
  font-size: 16pt;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2mm 6mm;
  color: #475569;
}
table {
  width: 100%;
  border-collapse: collapse;
  page-break-inside: auto;
}
thead {
  display: table-header-group;
}
tr {
  page-break-inside: avoid;
}
th,td {
  padding: 1.6mm 2mm;
  border: 1px solid #cbd5e1;
  text-align: right;
  vertical-align: top;
}
th {
  background: #f1f5f9;
  font-weight: 700;
}
tfoot th {
  background: #f8fafc;
}
.num {
  direction: ltr;
  text-align: left;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
@media print {
  body {
    min-height: auto;
    padding: 0;
    font-size: 8.5pt;
  }
}
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(model.title)}</h1>
    <div class="meta">${metadata}</div>
  </header>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
    ${footer}
  </table>
</body>
</html>`;
}

function renderPrintCell(
  tag: "th" | "td",
  value: string,
  numeric = false,
): string {
  const classAttribute = numeric ? ' class="num"' : "";
  return `<${tag}${classAttribute}>${escapeHtml(value)}</${tag}>`;
}

function renderPrintRow(
  row: readonly string[],
  columns: readonly InventoryPrintColumn[],
  tag: "th" | "td",
): string {
  return row
    .map((value, index) => renderPrintCell(tag, value, columns[index]?.numeric))
    .join("");
}

function printInventoryModel(model: InventoryPrintDocument): void {
  const document = globalThis.document;
  cleanupPrintArtifacts(document);
  const parsed = new DOMParser().parseFromString(
    createInventoryPrintHtml(model),
    "text/html",
  );
  const host = document.createElement("div");
  host.id = "inventory-print-host";
  host.dir = "rtl";
  host.innerHTML = parsed.body.innerHTML;
  const style = document.createElement("style");
  style.id = "inventory-print-style";
  style.textContent = `
#inventory-print-host {
  display: none;
}
@page{size:A4 ${model.orientation};margin:10mm}
@media print {
  html,body {
    margin: 0!important;
    padding: 0!important;
    background: #fff!important;
  }
  body>*:not(#inventory-print-host) {
    display: none!important;
  }
  body>#inventory-print-host {
    display: block!important;
    direction: rtl;
    color: #111827;
    font-family: Vazirmatn,Tahoma,Arial,sans-serif;
    font-size: 8.5pt;
  }
  #inventory-print-host header {
    display: grid;
    gap: 3mm;
    margin-bottom: 5mm;
    padding-bottom: 4mm;
    border-bottom: 1px solid #94a3b8;
  }
  #inventory-print-host h1 {
    margin: 0;
    font-size: 16pt;
  }
  #inventory-print-host .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 2mm 6mm;
    color: #475569;
  }
  #inventory-print-host table {
    width: 100%;
    border-collapse: collapse;
  }
  #inventory-print-host thead {
    display: table-header-group;
  }
  #inventory-print-host tr {
    page-break-inside: avoid;
  }
  #inventory-print-host th,#inventory-print-host td {
    padding: 1.6mm 2mm;
    border: 1px solid #cbd5e1;
    text-align: right;
    vertical-align: top;
  }
  #inventory-print-host th {
    background: #f1f5f9;
  }
  #inventory-print-host .num {
    direction: ltr;
    text-align: left;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}
`;
  document.head.append(style);
  document.body.append(host);
  globalThis.addEventListener(
    "afterprint",
    () => cleanupPrintArtifacts(document),
    { once: true },
  );
  globalThis.focus();
  globalThis.print();
}

function toolbarButton(document: Document, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  Object.assign(button.style, {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    padding: "8px 12px",
    cursor: "pointer",
  });
  return button;
}

function cleanupPrintArtifacts(document: Document): void {
  document.getElementById("inventory-print-host")?.remove();
  document.getElementById("inventory-print-style")?.remove();
}

function downloadBytes(
  bytes: Uint8Array,
  fileName: string,
  mime: string,
): void {
  // Copy the supplied view into an ArrayBuffer, including shared-buffer inputs.
  const buffer = new Uint8Array(bytes).buffer;
  const blob = new Blob([buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const safeFileStem = (value: string): string =>
  value.replace(/[\\/:*?"<>|]+/g, "-").trim() || "inventory";
const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
