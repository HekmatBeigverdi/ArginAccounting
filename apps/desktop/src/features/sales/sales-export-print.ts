import {
  calculateSalesLineTotals,
  type SalesDocumentSnapshot,
  type SalesDocumentStatus,
} from "@argin/sales";
import { createInventoryXlsx } from "@argin/inventory-tauri";

export interface SalesOutputDocument extends SalesDocumentSnapshot {
  readonly status: SalesDocumentStatus;
}

export interface SalesPrintModel {
  readonly title: string;
  readonly fileStem: string;
  readonly orientation: "landscape";
  readonly metadata: readonly { label: string; value: string }[];
  readonly columns: readonly { label: string; numeric?: boolean }[];
  readonly rows: readonly (readonly string[])[];
  readonly footer: readonly string[];
}

const DOCUMENT_TYPE_LABELS: Record<SalesDocumentSnapshot["documentType"], string> = {
  "sales-order": "سفارش فروش",
  "sales-invoice": "فاکتور فروش",
  "sales-return": "برگشت از فروش",
  "sales-correction": "اصلاح فروش",
};

const DOCUMENT_STATUS_LABELS: Record<SalesDocumentStatus, string> = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  approved: "تأییدشده",
  finalized: "قطعی",
  cancelled: "لغوشده",
};

export function createSalesPrintModel(input: {
  document: SalesOutputDocument;
  companyName: string;
  branchName: string;
}): SalesPrintModel {
  const salesDocument = input.document;
  const totals = salesDocument.lines.map((line) =>
    line.commercialTerms ? calculateSalesLineTotals(line.commercialTerms) : null,
  );
  const currency =
    salesDocument.lines.find((line) => line.commercialTerms)?.commercialTerms?.currency ?? "IRR";
  const sumTotals = (key: "grossAmount" | "discountAmount" | "taxAmount" | "grandTotal") =>
    totals.reduce((total, lineTotals) => total + (lineTotals?.[key] ?? 0), 0);

  return Object.freeze({
    title: DOCUMENT_TYPE_LABELS[salesDocument.documentType],
    fileStem: sanitizeFileStem(
      DOCUMENT_TYPE_LABELS[salesDocument.documentType] +
        "-" +
        (salesDocument.documentNumber ?? salesDocument.documentId),
    ),
    orientation: "landscape" as const,
    metadata: Object.freeze([
      { label: "شرکت", value: input.companyName },
      { label: "شعبه", value: input.branchName },
      { label: "شماره سند", value: salesDocument.documentNumber ?? "پیش‌نویس" },
      {
        label: "تاریخ",
        value: new Intl.DateTimeFormat("fa-IR-u-ca-persian").format(
          new Date(salesDocument.businessDate + "T12:00:00"),
        ),
      },
      {
        label: "مشتری",
        value: salesDocument.customer.code + " — " + salesDocument.customer.displayName,
      },
      { label: "وضعیت", value: DOCUMENT_STATUS_LABELS[salesDocument.status] },
      { label: "توضیحات", value: salesDocument.description ?? "—" },
    ]),
    columns: Object.freeze([
      { label: "ردیف", numeric: true },
      { label: "کالا / خدمت" },
      { label: "نوع" },
      { label: "تعداد", numeric: true },
      { label: "قیمت واحد", numeric: true },
      { label: "تخفیف", numeric: true },
      { label: "مالیات", numeric: true },
      { label: "جمع", numeric: true },
    ]),
    rows: Object.freeze(
      salesDocument.lines.map((line) => {
        const lineTotals = line.commercialTerms
          ? calculateSalesLineTotals(line.commercialTerms)
          : null;
        return Object.freeze([
          String(line.position),
          line.description || line.item.productId,
          line.lineKind === "service" ? "خدمت" : "کالا",
          String(line.commercialTerms?.quantity ?? ""),
          formatMoney(line.commercialTerms?.unitPrice ?? 0),
          formatMoney(lineTotals?.discountAmount ?? 0),
          formatMoney(lineTotals?.taxAmount ?? 0),
          formatMoney(lineTotals?.grandTotal ?? 0),
        ]);
      }),
    ),
    footer: Object.freeze([
      "",
      "",
      "",
      "",
      currency + " " + formatMoney(sumTotals("grossAmount")),
      formatMoney(sumTotals("discountAmount")),
      formatMoney(sumTotals("taxAmount")),
      currency + " " + formatMoney(sumTotals("grandTotal")),
    ]),
  });
}

export function downloadSalesBytes(bytes: Uint8Array, name: string, mime: string): void {
  download(bytes, name, mime);
}

export function downloadSalesXlsx(model: SalesPrintModel): void {
  const rows = model.rows.map((row) =>
    Object.fromEntries(model.columns.map((column, index) => [column.label, row[index] ?? ""])),
  );
  download(
    createInventoryXlsx(rows, model.title),
    model.fileStem + ".xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

export function openSalesPrintPreview(model: SalesPrintModel): void {
  const ownerDocument = document;
  ownerDocument.getElementById("sales-print-preview")?.remove();
  const previousOverflow = ownerDocument.body.style.overflow;
  ownerDocument.body.style.overflow = "hidden";
  const overlay = ownerDocument.createElement("div");
  overlay.id = "sales-print-preview";
  overlay.dir = "rtl";
  overlay.tabIndex = -1;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    display: "grid",
    gridTemplateRows: "56px minmax(0,1fr)",
    background: "#e2e8f0",
  });
  const toolbar = ownerDocument.createElement("div");
  Object.assign(toolbar.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    background: "#fff",
    fontFamily: "Vazirmatn,Tahoma,sans-serif",
  });
  const title = ownerDocument.createElement("strong");
  title.textContent = "پیش‌نمایش چاپ — " + model.title;
  title.style.marginInlineEnd = "auto";
  const printButton = createButton("چاپ / ذخیره PDF");
  const closeButton = createButton("بستن");
  const previewFrame = ownerDocument.createElement("iframe");
  previewFrame.srcdoc = createSalesPrintHtml(model);
  previewFrame.title = "پیش‌نمایش " + model.title;
  Object.assign(previewFrame.style, {
    width: "100%",
    height: "100%",
    border: "0",
    background: "#fff",
  });
  const dismiss = () => {
    overlay.remove();
    ownerDocument.body.style.overflow = previousOverflow;
  };
  printButton.onclick = () => printSales(model);
  closeButton.onclick = dismiss;
  overlay.onkeydown = (event) => {
    if (event.key === "Escape") {
      dismiss();
    }
  };
  toolbar.append(title, printButton, closeButton);
  overlay.append(toolbar, previewFrame);
  ownerDocument.body.append(overlay);
  overlay.focus();
}

export function createSalesPrintHtml(model: SalesPrintModel): string {
  const headerCells = model.columns
    .map((column) => createTableCell("th", column.label, column.numeric))
    .join("");
  const rows = model.rows
    .map((row) => {
      const cells = row
        .map((value, index) => createTableCell("td", value, model.columns[index]?.numeric))
        .join("");
      return "<tr>" + cells + "</tr>";
    })
    .join("");
  const footerCells = model.footer
    .map((value, index) => createTableCell("th", value, model.columns[index]?.numeric))
    .join("");
  const metadataHtml = model.metadata
    .map(
      (item) =>
        "<span><b>" + escapeHtml(item.label) + ":</b> " + escapeHtml(item.value) + "</span>",
    )
    .join("");

  return (
    '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>' +
    escapeHtml(model.title) +
    "</title><style>" +
    printCss +
    "</style></head><body><header><h1>" +
    escapeHtml(model.title) +
    '</h1><div class="meta">' +
    metadataHtml +
    "</div></header><table><thead><tr>" +
    headerCells +
    "</tr></thead><tbody>" +
    rows +
    "</tbody><tfoot><tr>" +
    footerCells +
    "</tr></tfoot></table></body></html>"
  );
}

function printSales(model: SalesPrintModel) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("مرورگر اجازه بازکردن پنجره چاپ را نداد.");
  }
  printWindow.document.write(createSalesPrintHtml(model));
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

const printCss = [
  "@page{size:A4 landscape;margin:10mm}",
  "*{box-sizing:border-box}",
  "body{margin:0;padding:8mm;direction:rtl;font-family:Vazirmatn,Tahoma,Arial,sans-serif;color:#111827;font-size:9pt}",
  "header{display:grid;gap:3mm;margin-bottom:5mm;border-bottom:1px solid #94a3b8;padding-bottom:4mm}",
  "h1{margin:0;font-size:16pt}",
  ".meta{display:flex;flex-wrap:wrap;gap:2mm 6mm;color:#475569}",
  "table{width:100%;border-collapse:collapse}",
  "thead{display:table-header-group}",
  "tr{page-break-inside:avoid}",
  "th,td{border:1px solid #cbd5e1;padding:1.6mm 2mm;text-align:right}",
  "th{background:#f1f5f9}",
  ".num{direction:ltr;text-align:left;font-variant-numeric:tabular-nums;white-space:nowrap}",
  "@media print{body{padding:0;font-size:8.5pt}}",
].join("");
function createTableCell(tag: "th" | "td", value: string, numeric?: boolean): string {
  const classAttribute = numeric ? ' class="num"' : "";
  return "<" + tag + classAttribute + ">" + escapeHtml(value) + "</" + tag + ">";
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("fa-IR").format(amount);
}

function sanitizeFileStem(value: string): string {
  return value.replace(/[\\/:*?\"<>|]+/g, "-").trim() || "sales";
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>\"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

function createButton(label: string) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  Object.assign(element.style, {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    padding: "8px 12px",
    cursor: "pointer",
  });
  return element;
}

function download(bytes: Uint8Array, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
