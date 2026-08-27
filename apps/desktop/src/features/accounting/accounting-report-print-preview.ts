import {
  createAccountingReportPrintHtml,
  type AccountingReportExportDocument,
} from "./accounting-report-export";

const previewId = "accounting-report-print-preview";
const printHostId = "accounting-report-print-host";
const printStyleId = "accounting-report-print-style";

export function openDesktopAccountingReportPrintPreview(
  report: AccountingReportExportDocument,
  autoPrint = false,
): void {
  const document = globalThis.document;
  closeExistingPreview(document);

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
    padding: "0 0 20px",
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

  function close(): void {
    removePrintArtifacts(document);
    overlay.remove();
    document.body.style.overflow = previousOverflow;
  }

  function print(): void {
    printAccountingReportFromMainWebview(report);
  }

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

function closeExistingPreview(document: Document): void {
  const existing = document.getElementById(previewId);
  if (existing) existing.remove();
  removePrintArtifacts(document);
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
