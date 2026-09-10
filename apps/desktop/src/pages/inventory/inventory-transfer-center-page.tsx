import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { inventoryPermissions, addInventoryStockQuantities, type InventoryDocumentListItem, type InventoryKardexReport, type InventoryProductBalanceSummaryReport, type InventoryQuantityBalanceReport, type InventoryStockKey } from "@argin/inventory";
import { createInventoryImportTemplateXlsx, parseInventoryCsv, parseInventoryXlsx, SqliteInventoryWorkspaceReader } from "@argin/inventory-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";
import { SqliteProductReader } from "@argin/product-tauri";
import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { useAuditServices } from "../../composition/audit";
import { createInventoryReportServices, type InventoryReportServices } from "../../composition/inventory/create-inventory-report-services";
import { Feedback } from "../../components/feedback";
import { Page } from "../../components/layout";
import { createInventoryImportController, inventoryImportBatchId, type InventoryImportPreview } from "../../features/inventory/inventory-import-controller";
import { createInventoryBalancePrintModel, createInventoryDocumentPrintModel, createInventoryKardexPrintModel, createInventorySummaryPrintModel, downloadInventoryBytes, downloadInventoryPrintModelXlsx, openInventoryPrintPreview } from "../../features/inventory/inventory-export-print";
import "./inventory-transfer-center-page.css";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_EXPORT_ROWS = 10_000;

export function InventoryTransferCenterPage() {
  const active = useActiveContext();
  const { session } = useAuthSession();
  const audit = useAuditServices();
  const actor = useMemo(() => ({
    id: session?.user.id ?? "desktop-local-user",
    displayName: session?.user.displayName ?? session?.user.username ?? "کاربر محلی",
    permissions: session?.user.permissions ?? [],
    branchIds: session?.user.branchIds ?? [],
  }), [session]);
  const fullAccess = actor.permissions.includes("system.full-access");
  const canImport = fullAccess || actor.permissions.includes(inventoryPermissions.import);
  const canExport = fullAccess || actor.permissions.includes(inventoryPermissions.export);
  const [reports, setReports] = useState<InventoryReportServices | null>(null);
  const [documents, setDocuments] = useState<readonly InventoryDocumentListItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [stockOptions, setStockOptions] = useState<InventoryQuantityBalanceReport | null>(null);
  const [selectedStockKey, setSelectedStockKey] = useState("");
  const [preview, setPreview] = useState<InventoryImportPreview | null>(null);
  const [importController, setImportController] = useState<ReturnType<typeof createInventoryImportController> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const companyName = active.activeCompany?.name ?? "شرکت فعال";
  const branchLabel = active.activeBranch?.name ?? "کل شرکت";
  const reportBranchId = fullAccess ? null : active.branchId || null;
  const scopeLabel = fullAccess ? "کل شرکت" : `شعبه ${branchLabel}`;

  useEffect(() => {
    let mounted = true;
    void getDesktopDatabase().then(async (database) => {
      if (!mounted) return;
      const service = createInventoryReportServices({ database, actor });
      setReports(service);
      setImportController(createInventoryImportController({ database, actor, audit }));
      if (active.companyId && service.canView) {
        const workspace = new SqliteInventoryWorkspaceReader(database);
        const page = await workspace.listDocuments({ filter: { companyId: active.companyId, search: null }, page: { page: 1, pageSize: 100 }, sort: { field: "businessDate", direction: "desc" } });
        if (mounted) setDocuments(page.items);
        const balances = await service.readBalances({ companyId: active.companyId, branchId: reportBranchId, includeZero: false, limit: 100 });
        if (mounted) setStockOptions(balances);
      }
    }).catch((reason) => mounted && setError(reason instanceof Error ? reason.message : "راه‌اندازی مرکز ورود و خروجی ناموفق بود."));
    return () => { mounted = false; };
  }, [actor, audit, active.companyId, reportBranchId]);

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !active.companyId || !active.fiscalYearId || !importController) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const data = file.name.toLowerCase().endsWith(".csv") ? parseInventoryCsv(new TextDecoder().decode(bytes)) : parseInventoryXlsx(bytes);
      const batchId = await inventoryImportBatchId(bytes);
      setPreview(await importController.preview({ data, batchId, companyId: active.companyId, branchId: active.branchId || null, fiscalYearId: active.fiscalYearId }));
    } catch (reason) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : "خواندن یا اعتبارسنجی فایل ناموفق بود.");
    } finally { setBusy(false); }
  }

  async function commitImport() {
    if (!preview || !importController || !active.companyId || !active.fiscalYearId) return;
    setBusy(true); setError("");
    try {
      const result = await importController.commit({ preview, companyId: active.companyId, branchId: active.branchId || null, fiscalYearId: active.fiscalYearId });
      setMessage(`${result.importedCount} سند پیش‌نویس آماده شد${result.replayedCount ? `؛ ${result.replayedCount} مورد از اجرای قبلی بازیابی شد` : ""}.`);
      setPreview(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "ورود اسناد ناموفق بود."); }
    finally { setBusy(false); }
  }

  async function documentModel() {
    if (!selectedDocumentId || !active.companyId || !reports) throw new Error("ابتدا یک سند را انتخاب کنید.");
    const detail = await reports.getDocument(active.companyId, fullAccess ? null : active.branchId || null, selectedDocumentId);
    if (!detail) throw new Error("سند انتخاب‌شده پیدا نشد.");
    const database = await getDesktopDatabase();
    const products = new SqliteProductReader(database);
    const productLabels = new Map<string, string>();
    for (const productId of new Set(detail.document.lines.map((line) => line.productId))) {
      const product = await products.getById({ companyId: active.companyId, productId });
      productLabels.set(productId, product ? `${product.code} — ${product.title}` : productId);
    }
    return createInventoryDocumentPrintModel({ document: detail.document, companyName, branchLabel, productLabel: (id) => productLabels.get(id) ?? id });
  }

  async function exportDocument(kind: "xlsx" | "print") {
    setBusy(true); setError("");
    try { const model = await documentModel(); kind === "xlsx" ? downloadInventoryPrintModelXlsx(model) : openInventoryPrintPreview(model); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "تهیه خروجی سند ناموفق بود."); }
    finally { setBusy(false); }
  }

  async function collectSummary(): Promise<InventoryProductBalanceSummaryReport> {
    if (!reports || !active.companyId) throw new Error("گزارش در دسترس نیست.");
    const items: InventoryProductBalanceSummaryReport["items"][number][] = [];
    let cursor: string | null = null;
    do {
      const page = await reports.readProductSummaries({ companyId: active.companyId, branchId: reportBranchId, includeZero: false, cursor, limit: 500 });
      items.push(...page.items); cursor = page.nextCursor;
      if (items.length > MAX_EXPORT_ROWS) throw new Error("حجم خروجی از سقف ۱۰٬۰۰۰ ردیف بیشتر است؛ فیلتر گزارش را محدودتر کنید.");
    } while (cursor);
    return Object.freeze({ items: Object.freeze(items), nextCursor: null });
  }

  async function collectBalances(): Promise<InventoryQuantityBalanceReport> {
    if (!reports || !active.companyId) throw new Error("گزارش در دسترس نیست.");
    const items: InventoryQuantityBalanceReport["items"][number][] = [];
    let cursor: string | null = null;
    do {
      const page = await reports.readBalances({ companyId: active.companyId, branchId: reportBranchId, includeZero: false, cursor, limit: 500 });
      items.push(...page.items); cursor = page.nextCursor;
      if (items.length > MAX_EXPORT_ROWS) throw new Error("حجم خروجی از سقف ۱۰٬۰۰۰ ردیف بیشتر است؛ فیلتر گزارش را محدودتر کنید.");
    } while (cursor);
    return Object.freeze({ items: Object.freeze(items), nextCursor: null });
  }

  async function collectKardex(stockKey: InventoryStockKey): Promise<InventoryKardexReport> {
    if (!reports || !active.companyId) throw new Error("گزارش در دسترس نیست.");
    const entries: InventoryKardexReport["entries"][number][] = [];
    let cursor: string | null = null, opening = "0", incoming = "0", outgoing = "0", closing = "0", first = true;
    do {
      const page = await reports.readKardex({ companyId: active.companyId, branchId: reportBranchId, stockKey, cursor, limit: 500 });
      if (first) { opening = page.openingQuantity; first = false; }
      incoming = addInventoryStockQuantities(incoming, page.incomingQuantity);
      outgoing = addInventoryStockQuantities(outgoing, page.outgoingQuantity);
      closing = page.closingQuantity; entries.push(...page.entries); cursor = page.nextCursor;
      if (entries.length > MAX_EXPORT_ROWS) throw new Error("کاردکس بیش از سقف ۱۰٬۰۰۰ ردیف است؛ بازه گزارش را محدودتر کنید.");
    } while (cursor);
    return Object.freeze({ stockKey, openingQuantity: opening, incomingQuantity: incoming, outgoingQuantity: outgoing, closingQuantity: closing, entries: Object.freeze(entries), nextCursor: null });
  }

  async function exportReport(kind: "summary" | "balances" | "kardex", output: "xlsx" | "print") {
    setBusy(true); setError("");
    try {
      let model;
      if (kind === "summary") model = createInventorySummaryPrintModel({ report: await collectSummary(), companyName, scopeLabel });
      else if (kind === "balances") model = createInventoryBalancePrintModel({ report: await collectBalances(), companyName, scopeLabel });
      else {
        const selected = stockOptions?.items.find((item) => JSON.stringify(item.stockKey) === selectedStockKey);
        if (!selected) throw new Error("برای خروجی کاردکس، ابتدا یک کالا/انبار را انتخاب کنید.");
        const kardex = await collectKardex(selected.stockKey);
        model = createInventoryKardexPrintModel({ report: kardex, companyName, scopeLabel, productLabel: `${selected.productCode} — ${selected.productTitle}`, warehouseLabel: `${selected.warehouseCode} — ${selected.warehouseTitle}` });
      }
      output === "xlsx" ? downloadInventoryPrintModelXlsx(model) : openInventoryPrintPreview(model);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "تهیه خروجی گزارش ناموفق بود."); }
    finally { setBusy(false); }
  }

  if (!canImport && !canExport) return <Page><Feedback tone="error">برای ورود، خروجی یا چاپ اسناد انبار مجوز کافی ندارید.</Feedback></Page>;

  return <Page className="inventory-transfer-center" dir="rtl">
    <header><h2>ورود، خروجی و چاپ انبار</h2><p>ورود فایل فقط پیش‌نویس ایجاد می‌کند؛ اثر موجودی تنها با مسیر ارسال، تأیید و قطعی‌کردن ایجاد می‌شود.</p></header>
    {error && <Feedback tone="error">{error}</Feedback>}{message && <Feedback tone="success">{message}</Feedback>}

    {canImport && <section className="inventory-transfer-card"><h3>ورود گروهی اسناد</h3><div className="inventory-transfer-actions"><label className="inventory-file-button">انتخاب Excel / CSV<input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void handleImportFile(event)} disabled={busy} /></label><button type="button" onClick={() => downloadInventoryBytes(createInventoryImportTemplateXlsx(), "الگوی-ورود-اسناد-انبار.xlsx", XLSX_MIME)}>دریافت الگوی Excel</button></div>{preview && <div className="inventory-import-preview"><div className="inventory-import-summary"><span>ردیف: <b>{preview.totalRows}</b></span><span>سند: <b>{preview.documentCount}</b></span><span>معتبر: <b>{preview.validRows}</b></span><span>خطادار: <b>{preview.invalidRows}</b></span></div><div className="inventory-import-table-wrap"><table><thead><tr><th>ردیف فایل</th><th>کلید سند</th><th>کد کالا</th><th>وضعیت / خطا</th></tr></thead><tbody>{preview.rows.slice(0, 300).map((row) => <tr key={row.rowNumber} className={row.valid ? "" : "is-error"}><td>{row.rowNumber}</td><td dir="ltr">{row.documentKey || "—"}</td><td dir="ltr">{row.productCode || "—"}</td><td>{row.valid ? "معتبر" : row.issues.map((issue) => issue.message).join("؛ ")}</td></tr>)}</tbody></table></div><button className="primary" type="button" disabled={busy || preview.invalidRows > 0 || preview.documentCount === 0} onClick={() => void commitImport()}>ایجاد پیش‌نویس‌ها</button></div>}</section>}

    {canExport && <><section className="inventory-transfer-card"><h3>خروجی سند انبار</h3><select value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)}><option value="">انتخاب سند…</option>{documents.map((document) => <option key={document.documentId} value={document.documentId}>{document.documentNumber ?? "پیش‌نویس"} — {document.businessDate}</option>)}</select><div className="inventory-transfer-actions"><button type="button" disabled={!selectedDocumentId || busy} onClick={() => void exportDocument("xlsx")}>Excel</button><button type="button" disabled={!selectedDocumentId || busy} onClick={() => void exportDocument("print")}>پیش‌نمایش چاپ / PDF</button></div></section>
    <section className="inventory-transfer-card"><h3>خروجی گزارش‌های موجودی</h3><p>خروجی تا سقف ۱۰٬۰۰۰ ردیف جمع‌آوری می‌شود و به صفحه جاری محدود نیست.</p><div className="inventory-output-grid"><div><strong>خلاصه موجودی کالا</strong><button type="button" onClick={() => void exportReport("summary", "xlsx")}>Excel</button><button type="button" onClick={() => void exportReport("summary", "print")}>چاپ / PDF</button></div><div><strong>موجودی تفکیکی</strong><button type="button" onClick={() => void exportReport("balances", "xlsx")}>Excel</button><button type="button" onClick={() => void exportReport("balances", "print")}>چاپ / PDF</button></div><div><strong>کاردکس تعدادی</strong><select value={selectedStockKey} onChange={(event) => setSelectedStockKey(event.target.value)}><option value="">کالا / انبار…</option>{stockOptions?.items.map((row) => <option key={JSON.stringify(row.stockKey)} value={JSON.stringify(row.stockKey)}>{row.productCode} — {row.warehouseCode} — {row.quantity}</option>)}</select><button type="button" disabled={!selectedStockKey} onClick={() => void exportReport("kardex", "xlsx")}>Excel</button><button type="button" disabled={!selectedStockKey} onClick={() => void exportReport("kardex", "print")}>چاپ / PDF</button></div></div></section></>}
  </Page>;
}
