import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { BelowCostLineRouting, BelowCostSalesPolicy, SalesDocumentSnapshot, SalesDocumentStatus, SalesLifecycleAction } from "@argin/sales";
import { SalesDomainError, calculateSalesLineTotals, salesPermissions } from "@argin/sales";
import { getDesktopDatabase } from "@argin/database-tauri";
import { parseInventoryCsv, parseInventoryXlsx } from "@argin/inventory-tauri";
import type { SalesOperationalTrace } from "@argin/sales-tauri";
import { FiscalValidationError } from "@argin/fiscal";
import { createSalesWorkspaceServices, type SalesWorkspaceDocument } from "../../composition/sales/create-sales-workspace-services";
import { SalesActionDialog } from "./sales-action-dialog";
import { SalesDocumentForm } from "./sales-document-form";
import { SalesFinalizeDialog } from "./sales-finalize-dialog";
import { SalesBelowCostPolicyDialog } from "./sales-below-cost-policy-dialog";
import type { WarehouseListItemDto } from "@argin/warehouse";
import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Page } from "../../components/layout";
import { Feedback } from "../../components/feedback";
import { createSalesPrintModel, downloadSalesBytes, downloadSalesXlsx, openSalesPrintPreview } from "../../features/sales/sales-export-print";
import { commitSalesImport, createSalesImportTemplateXlsx, previewSalesImport, salesImportBatchId, type SalesImportPreview } from "../../features/sales/sales-import-controller";
import "./sales-documents-page.css";

const TYPE_LABELS: Record<SalesDocumentSnapshot["documentType"], string> = {
  "sales-order": "سفارش فروش",
  "sales-invoice": "فاکتور فروش",
  "sales-return": "برگشت از فروش",
  "sales-correction": "اصلاح فروش",
};

const STATUS_LABELS: Record<SalesDocumentStatus, string> = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  approved: "تأییدشده",
  finalized: "قطعی",
  cancelled: "لغوشده",
};

const persianDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const numberFormatter = new Intl.NumberFormat("fa-IR");

function formatBusinessDate(value: string) {
  const date = new Date(value + "T00:00:00");
  return Number.isNaN(date.getTime()) ? value : persianDateFormatter.format(date);
}

function calculateLineTotal(line: SalesDocumentSnapshot["lines"][number]) {
  const terms = line.commercialTerms;
  if (!terms) return 0;

  return calculateSalesLineTotals(terms).grandTotal;
}

const ACTION_LABELS: Record<SalesLifecycleAction, string> = {
  submit: "ارسال برای تأیید", approve: "تأیید", finalize: "قطعی‌کردن", cancel: "لغو سند", reject: "برگشت به پیش‌نویس",
};
const ACTION_MESSAGES: Record<SalesLifecycleAction, string> = {
  submit: "سند برای تأیید ارسال شد.", approve: "سند فروش تأیید شد.", finalize: "سند فروش قطعی شد.",
  cancel: "سند فروش لغو شد.", reject: "سند به پیش‌نویس برگشت داده شد.",
};

export function SalesDocumentsPage() {
  const active = useActiveContext();
  const { session } = useAuthSession();
  return <SalesDocumentsWorkspace key={JSON.stringify([active.companyId, active.branchId, active.fiscalYearId, session?.user.id])} />;
}

function SalesDocumentsWorkspace() {
  const activeContext = useActiveContext();
  const { session } = useAuthSession();
  const [documents, setDocuments] = useState<readonly SalesWorkspaceDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [newDocumentScope, setNewDocumentScope] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<SalesWorkspaceDocument | null>(null);
  const [pendingAction, setPendingAction] = useState<"cancel" | "reject" | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [warehouses, setWarehouses] = useState<readonly WarehouseListItemDto[]>([]);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [belowCostPolicy, setBelowCostPolicy] = useState<BelowCostSalesPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationInFlight = useRef(false);
  const mutationRequests = useRef(new Map<string, string>());
  const [message, setMessage] = useState("");
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [trace, setTrace] = useState<SalesOperationalTrace | null>(null);
  const [importPreview, setImportPreview] = useState<SalesImportPreview | null>(null);
  const scopeKey = JSON.stringify([activeContext.companyId, activeContext.branchId, activeContext.fiscalYearId, session?.user.id]);
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;

  function openNewDocument() {
    setError("");
    setMessage("");
    if (!activeContext.companyId || !activeContext.branchId || !activeContext.fiscalYearId) {
      setError("شرکت، شعبه و سال مالی فعال را انتخاب کنید.");
      return;
    }
    setEditingDocument(null);
    setNewDocumentScope(scopeKey);
  }

  function documentCreated(document: SalesDocumentSnapshot) {
    if (currentScope.current !== scopeKey) return;
    setNewDocumentScope(null);
    setDocuments(current => {
      const previous = current.find(value => value.documentId === document.documentId);
      const saved: SalesWorkspaceDocument = {
        ...document, status: "draft", version: (previous?.version ?? 0) + 1,
        lifecycle: previous?.lifecycle ?? { documentId: document.documentId, documentType: document.documentType, status: "draft", transitions: [] },
      };
      return [saved, ...current.filter(value => value.documentId !== document.documentId)];
    });
    setSelectedId(document.documentId);
    setSearch("");
    setMessage(editingDocument ? "تغییرات سند فروش ذخیره شد." : "پیش‌نویس سند فروش ایجاد شد.");
    setEditingDocument(null);
    setRefreshRevision(value => value + 1);
  }

  const hasPermission = (permission: string) =>
    Boolean(
      session?.user.permissions.includes("system.full-access") ||
        session?.user.permissions.includes(permission),
    );

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      if (!activeContext.companyId || !activeContext.branchId || !activeContext.fiscalYearId || !session) return;

      try {
        const database = await getDesktopDatabase();
        const services = createSalesWorkspaceServices(database, session.user);
        const loadedDocuments = await services.list(activeContext.companyId, activeContext.branchId, activeContext.fiscalYearId);
        if (cancelled) return;

        setDocuments(loadedDocuments);
        setSelectedId((currentId) =>
          currentId && loadedDocuments.some((document) => document.documentId === currentId)
            ? currentId
            : loadedDocuments[0]?.documentId ?? null,
        );
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "بارگذاری اسناد فروش ناموفق بود.",
          );
        }
      }
    }

    void loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [activeContext.companyId, activeContext.branchId, activeContext.fiscalYearId, session, refreshRevision]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fa");
    if (!query) return documents;

    return documents.filter((document) =>
      [
        document.documentNumber,
        document.customer.displayName,
        document.customer.code,
        TYPE_LABELS[document.documentType],
      ].some((value) => value?.toLocaleLowerCase("fa").includes(query)),
    );
  }, [documents, search]);

  const selectedDocument =
    documents.find((document) => document.documentId === selectedId) ?? null;
  const documentTotal =
    selectedDocument?.lines.reduce(
      (total, line) => total + calculateLineTotal(line),
      0,
    ) ?? 0;

  function canAct(action: SalesLifecycleAction | "edit") {
    if (busy || !selectedDocument || !hasPermission(salesPermissions[action])) return false;
    if (!session?.user.permissions.includes("system.full-access") && !session?.user.branchIds.includes(activeContext.branchId)) return false;
    const status = selectedDocument.status;
    if (action === "edit" || action === "submit") return status === "draft";
    if (action === "approve") return status === "submitted";
    if (action === "finalize") return status === "approved";
    if (action === "reject") return status === "submitted" || status === "approved";
    return status === "draft" || status === "submitted" || status === "approved";
  }

  function openEdit() {
    if (!canAct("edit") || !selectedDocument) return;
    setError("");
    setMessage("");
    setEditingDocument(selectedDocument);
    setNewDocumentScope(scopeKey);
  }

  async function runAction(
    action: SalesLifecycleAction,
    reason = "",
    belowCost?: {
      stockRouting: readonly BelowCostLineRouting[];
      acknowledgeBelowCostWarning: boolean;
      belowCostApprovalReason: string | null;
    },
  ) {
    if (!selectedDocument || !session || mutationInFlight.current || !canAct(action)) return;
    const target = selectedDocument;
    mutationInFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const fingerprint = JSON.stringify([target.documentId, target.version, action, reason]);
    const submissionId = mutationRequests.current.get(fingerprint) ?? crypto.randomUUID();
    mutationRequests.current.set(fingerprint, submissionId);
    try {
      const services = createSalesWorkspaceServices(await getDesktopDatabase(), session.user);
      const result = await services.transition({
        ...target.scope, documentId: target.documentId, expectedVersion: target.version,
        submissionId, action, reason, ...belowCost,
      });
      if (currentScope.current !== scopeKey) return;
      setDocuments(current => current.map(value => value.documentId === target.documentId
        ? { ...result.document, status: result.lifecycle.status, version: result.version, lifecycle: result.lifecycle }
        : value));
      setPendingAction(null);
      setMessage(ACTION_MESSAGES[action]);
    } catch (error) {
      if (currentScope.current !== scopeKey) return;
      if (error instanceof SalesDomainError && error.code === "sales.concurrency_conflict") {
        setError("سند هم‌زمان تغییر کرده است؛ نسخهٔ جدید بارگذاری شد. دوباره عملیات را بررسی کنید.");
        setPendingAction(null);
        setRefreshRevision(value => value + 1);
      } else if (error instanceof SalesDomainError && error.code === "sales.lifecycle_transition_invalid") {
        setError("این عملیات در وضعیت فعلی سند مجاز نیست.");
      } else if (error instanceof FiscalValidationError) {
        setError(error.issues.map(issue => issue.message).join(" "));
      } else {
        setError(error instanceof Error ? error.message : "عملیات سند فروش ناموفق بود.");
      }
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }

  async function openFinalize() {
    if (!selectedDocument || !session || !canAct("finalize")) return;
    setError("");
    setMessage("");
    if (selectedDocument.documentType !== "sales-invoice" && selectedDocument.documentType !== "sales-return") {
      await runAction("finalize");
      return;
    }
    setBusy(true);
    try {
      const services = createSalesWorkspaceServices(await getDesktopDatabase(), session.user);
      const selectedWarehouses = await services.selectWarehouses(selectedDocument.scope.companyId, selectedDocument.scope.branchId);
      setWarehouses(selectedWarehouses);
      setFinalizeOpen(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "بارگذاری انبارهای مجاز ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function openPolicy() {
    if (!session || !activeContext.companyId || !activeContext.branchId) return;
    setError("");
    try {
      const services = createSalesWorkspaceServices(await getDesktopDatabase(), session.user);
      setBelowCostPolicy(await services.getBelowCostPolicy(
        activeContext.companyId, activeContext.branchId, new Date().toISOString().slice(0, 10),
      ));
      setPolicyOpen(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "بارگذاری سیاست فروش ناموفق بود.");
    }
  }

  async function savePolicy(input: { mode: BelowCostSalesPolicy["mode"]; minimumMarginBasisPoints: number; effectiveFrom: string }) {
    if (!session || !activeContext.companyId || !activeContext.branchId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const services = createSalesWorkspaceServices(await getDesktopDatabase(), session.user);
      const saved = await services.saveBelowCostPolicy({
        companyId: activeContext.companyId, branchId: activeContext.branchId, ...input,
      });
      setBelowCostPolicy(saved); setPolicyOpen(false);
      setMessage("نسخه جدید سیاست فروش زیر بهای تمام‌شده ثبت شد.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "ذخیره سیاست فروش ناموفق بود.");
    } finally { setBusy(false); }
  }


  useEffect(() => {
    let cancelled=false; setTrace(null);
    if (!selectedDocument || !session || !activeContext.companyId || !hasPermission(salesPermissions.traceView)) return;
    void getDesktopDatabase().then(db=>createSalesWorkspaceServices(db,session.user)
      .getOperationalTrace(activeContext.companyId,activeContext.branchId,selectedDocument.documentId))
      .then(value=>{if(!cancelled)setTrace(value);}).catch(()=>{if(!cancelled)setTrace(null);});
    return()=>{cancelled=true;};
  },[selectedDocument?.documentId,selectedDocument?.version,session,activeContext.companyId,activeContext.branchId]);

  function exportSelected(kind:"xlsx"|"print"){
    if(!selectedDocument||!hasPermission(salesPermissions.export))return;
    const model=createSalesPrintModel({document:selectedDocument,companyName:activeContext.activeCompany?.legalName??"شرکت فعال",branchName:activeContext.activeBranch?.name??"شعبه فعال"});
    if(kind==="xlsx")downloadSalesXlsx(model);else openSalesPrintPreview(model);
  }

  async function handleImportFile(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value="";
    if(!file||!session||!activeContext.companyId||!activeContext.branchId||!hasPermission(salesPermissions.import))return;
    setBusy(true);setError("");setMessage("");
    try{const bytes=new Uint8Array(await file.arrayBuffer()),data=file.name.toLowerCase().endsWith(".csv")?parseInventoryCsv(new TextDecoder().decode(bytes)):parseInventoryXlsx(bytes);
      const services=createSalesWorkspaceServices(await getDesktopDatabase(),session.user);
      setImportPreview(await previewSalesImport({data,batchId:await salesImportBatchId(bytes),services,companyId:activeContext.companyId,branchId:activeContext.branchId}));
    }catch(reason){setImportPreview(null);setError(reason instanceof Error?reason.message:"خواندن فایل فروش ناموفق بود.");}finally{setBusy(false);}
  }
  async function commitImport(){
    if(!importPreview||!session||!activeContext.companyId||!activeContext.branchId||!activeContext.fiscalYearId)return;
    setBusy(true);setError("");
    try{const services=createSalesWorkspaceServices(await getDesktopDatabase(),session.user);const result=await commitSalesImport({preview:importPreview,services,companyId:activeContext.companyId,branchId:activeContext.branchId,fiscalYearId:activeContext.fiscalYearId});setImportPreview(null);setMessage(numberFormatter.format(result.created)+" پیش‌نویس فروش وارد شد.");setRefreshRevision(x=>x+1);}
    catch(reason){setError(reason instanceof Error?reason.message:"ورود اسناد فروش ناموفق بود.");}finally{setBusy(false);}
  }

  return (
    <Page>
      <div className="sales-workspace" dir="rtl">
        <header className="sales-workspace__toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جست‌وجو در شماره سند، مشتری یا نوع سند"
            aria-label="جست‌وجوی اسناد فروش"
          />
          {hasPermission(salesPermissions.import) && hasPermission(salesPermissions.create) && <button disabled={busy} onClick={()=>downloadSalesBytes(createSalesImportTemplateXlsx(),"الگوی-ورود-اسناد-فروش.xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}>الگوی ورود</button>}
          {hasPermission(salesPermissions.import) && hasPermission(salesPermissions.create) && <label className="sales-import-button">ورود Excel / CSV<input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={event=>void handleImportFile(event)} /></label>}
          {hasPermission(salesPermissions.export) && <button disabled={busy||!selectedDocument} onClick={()=>exportSelected("xlsx")}>Excel</button>}
          {hasPermission(salesPermissions.export) && <button disabled={busy||!selectedDocument} onClick={()=>exportSelected("print")}>چاپ / PDF</button>}
          {hasPermission(salesPermissions.manageBelowCostPolicy) && (
            <button disabled={busy} onClick={() => void openPolicy()}>سیاست فروش زیر بها</button>
          )}
          <button className="primary" disabled={busy || !hasPermission(salesPermissions.create)} onClick={openNewDocument}>
            سند فروش جدید
          </button>
        </header>

        {error && <Feedback tone="error">{error}</Feedback>}
        {message && <Feedback tone="success">{message}</Feedback>}
        {importPreview && <section className="sales-import-preview"><strong>پیش‌نمایش ورود فروش</strong><span>ردیف فایل: {numberFormatter.format(importPreview.totalRows)}</span><span>سند: {numberFormatter.format(importPreview.documents.length)}</span><span>خطادار: {numberFormatter.format(importPreview.invalidCount)}</span><div>{importPreview.documents.slice(0,100).map(doc=><p key={doc.key} className={doc.valid?"":"is-error"}><b dir="ltr">{doc.key}</b> — {doc.valid?"معتبر":doc.issues.join("؛ ")}</p>)}</div><button className="primary" disabled={busy||importPreview.invalidCount>0||!importPreview.documents.length} onClick={()=>void commitImport()}>ایجاد پیش‌نویس‌ها</button><button disabled={busy} onClick={()=>setImportPreview(null)}>انصراف</button></section>}
        {newDocumentScope === scopeKey && session && (
          <SalesDocumentForm
            key={scopeKey + (editingDocument?.documentId ?? "new")}
            initialDocument={editingDocument ?? undefined}
            expectedVersion={editingDocument?.version}
            actor={session.user}
            companyId={activeContext.companyId}
            branchId={activeContext.branchId}
            fiscalYearId={activeContext.fiscalYearId}
            onClose={() => { setNewDocumentScope(null); setEditingDocument(null); setRefreshRevision(value => value + 1); }}
            onCreated={documentCreated}
          />
        )}

        {policyOpen && (
          <SalesBelowCostPolicyDialog current={belowCostPolicy} busy={busy} onSave={input => void savePolicy(input)} onClose={() => setPolicyOpen(false)} />
        )}

        {finalizeOpen && selectedDocument && session && (
          <SalesFinalizeDialog
            document={selectedDocument}
            warehouses={warehouses}
            busy={busy}
            canApproveBelowCost={hasPermission(salesPermissions.approveBelowCost)}
            guardEnabled={selectedDocument.documentType === "sales-invoice"}
            preview={async routing => {
              const services = createSalesWorkspaceServices(await getDesktopDatabase(), session.user);
              return services.previewBelowCost(selectedDocument, routing);
            }}
            onConfirm={input => {
              setFinalizeOpen(false);
              void runAction("finalize", "", {
                stockRouting: input.routing,
                acknowledgeBelowCostWarning: input.acknowledgeWarning,
                belowCostApprovalReason: input.approvalReason,
              });
            }}
            onClose={() => setFinalizeOpen(false)}
          />
        )}

        {pendingAction && (
          <SalesActionDialog title={ACTION_LABELS[pendingAction]} busy={busy} error={error}
            onConfirm={reason => void runAction(pendingAction, reason)}
            onClose={() => { setPendingAction(null); setError(""); }} />
        )}

        <div className="sales-workspace__grid">
          <section className="sales-list" aria-label="فهرست اسناد فروش">
            <div className="sales-list__header">
              <span>تاریخ</span>
              <span>سند / مشتری</span>
              <span>وضعیت</span>
            </div>
            <div className="sales-list__scroll">
              {filteredDocuments.map((document) => {
                const isSelected = selectedId === document.documentId;

                return (
                  <button
                    key={document.documentId}
                    disabled={busy}
                    className={"sales-list__row " + (isSelected ? "is-active" : "")}
                    onClick={() => setSelectedId(document.documentId)}
                  >
                    <span>{formatBusinessDate(document.businessDate)}</span>
                    <span>
                      <strong>{document.documentNumber ?? "بدون شماره"}</strong>
                      <small>
                        {TYPE_LABELS[document.documentType]} · {document.customer.displayName}
                      </small>
                    </span>
                    <span className={"status status--" + (isSelected ? "active" : "normal")}>
                      {STATUS_LABELS[document.status]}
                    </span>
                  </button>
                );
              })}
              {filteredDocuments.length === 0 && (
                <div className="empty">سند فروشی برای نمایش وجود ندارد.</div>
              )}
            </div>
          </section>

          <section className="sales-detail">
            {selectedDocument ? (
              <>
                <header>
                  <div>
                    <h2>
                      {selectedDocument.documentNumber ?? TYPE_LABELS[selectedDocument.documentType]}
                    </h2>
                    <div className="meta">
                      <span>{TYPE_LABELS[selectedDocument.documentType]}</span>
                      <span>وضعیت: {STATUS_LABELS[selectedDocument.status]}</span>
                      <span>مشتری: {selectedDocument.customer.displayName}</span>
                      <span>تاریخ: {formatBusinessDate(selectedDocument.businessDate)}</span>
                    </div>
                  </div>
                </header>

                <div className="sales-detail__actions" aria-busy={busy}>
                  <button disabled={!canAct("edit")} onClick={openEdit}>ویرایش</button>
                  <button disabled={!canAct("submit")} onClick={() => void runAction("submit")}>ارسال برای تأیید</button>
                  <button disabled={!canAct("approve")} onClick={() => void runAction("approve")}>تأیید</button>
                  <button disabled={!canAct("finalize")} onClick={() => void openFinalize()}>قطعی‌کردن</button>
                  <button disabled={!canAct("cancel")} onClick={() => { setError(""); setPendingAction("cancel"); }}>لغو</button>
                  {(selectedDocument.status === "submitted" || selectedDocument.status === "approved") && (
                    <button disabled={!canAct("reject")} onClick={() => { setError(""); setPendingAction("reject"); }}>برگشت به پیش‌نویس</button>
                  )}
                  {busy && <span role="status">در حال ثبت عملیات…</span>}
                </div>

                <div className="sales-summary">
                  <div>
                    <span>مشتری</span>
                    <strong>{selectedDocument.customer.displayName}</strong>
                  </div>
                  <div>
                    <span>تعداد اقلام</span>
                    <strong>{numberFormatter.format(selectedDocument.lines.length)}</strong>
                  </div>
                  <div>
                    <span>جمع فروش</span>
                    <strong dir="ltr">
                      {numberFormatter.format(documentTotal)} {selectedDocument.lines[0]?.commercialTerms?.currency ?? ""}
                    </strong>
                  </div>
                </div>

                <div className="sales-lines-wrap">
                  <table className="sales-lines">
                    <thead>
                      <tr>
                        <th>ردیف</th>
                        <th>کالا / خدمت</th>
                        <th>نوع</th>
                        <th>تعداد</th>
                        <th>قیمت واحد</th>
                        <th>تخفیف</th>
                        <th>مالیات</th>
                        <th>جمع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDocument.lines.map((line) => {
                        const terms = line.commercialTerms;

                        return (
                          <tr key={line.lineId}>
                            <td>{numberFormatter.format(line.position)}</td>
                            <td>
                              <strong>{line.description || line.item.productId}</strong>
                              <small dir="ltr">{line.item.productId}</small>
                            </td>
                            <td>{line.lineKind === "service" ? "خدمت" : "کالا"}</td>
                            <td dir="ltr">{terms?.quantity ?? "-"}</td>
                            <td dir="ltr">{terms ? numberFormatter.format(terms.unitPrice) : "-"}</td>
                            <td>{terms ? numberFormatter.format(calculateSalesLineTotals(terms).discountAmount) : "—"}</td>
                            <td>{terms ? numberFormatter.format(calculateSalesLineTotals(terms).taxAmount) : "—"}</td>
                            <td dir="ltr">{numberFormatter.format(calculateLineTotal(line))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {selectedDocument.lifecycle.transitions.length > 0 && (
                  <details className="sales-history">
                    <summary>تاریخچهٔ گردش سند</summary>
                    <ol>{selectedDocument.lifecycle.transitions.map(transition => (
                      <li key={transition.transitionId}>
                        {ACTION_LABELS[transition.action]} — {STATUS_LABELS[transition.toStatus]}
                        {" · "}{new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(transition.occurredAt))}
                        {transition.reason && <span> · {transition.reason}</span>}
                      </li>
                    ))}</ol>
                  </details>
                )}
                <details className="sales-history">
                  <summary>ردیابی و ارتباطات سند</summary>
                  <dl>
                    <dt>شناسه پایدار سند</dt>
                    <dd dir="ltr">{selectedDocument.documentId}</dd>
                    <dt>سند مرتبط</dt>
                    <dd dir="ltr">{selectedDocument.relatedDocumentReference?.documentId ?? "—"}</dd>
                    <dt>منبع سند</dt>
                    <dd dir="ltr">{selectedDocument.sourceReference?.sourceDocumentId ?? "—"}</dd>
                    {hasPermission(salesPermissions.traceView) && <><dt>سند انبار مرتبط</dt><dd>{trace?.inventoryDocument ? (trace.inventoryDocument.number ?? trace.inventoryDocument.id)+" — "+trace.inventoryDocument.status : "هنوز ایجاد نشده"}</dd><dt>حرکت موجودی</dt><dd>{trace ? numberFormatter.format(trace.movements.length) : "…"}</dd><dt>ارزش‌گذاری</dt><dd>{trace ? (trace.valuations.length ? trace.valuations.map(v=>v.costState+" / "+v.method+" / r"+v.revision).join("، ") : "هنوز ایجاد نشده") : "…"}</dd></>}
                  </dl>
                </details>
              </>
            ) : (
              <div className="empty">یک سند فروش را انتخاب کنید.</div>
            )}
          </section>
        </div>
      </div>
    </Page>
  );
}
