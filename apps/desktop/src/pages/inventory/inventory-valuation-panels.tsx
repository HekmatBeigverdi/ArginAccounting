import { Dialog } from "../../components/feedback";
import { useState } from "react";
import type {
  InventoryValuationAsOfReport,
  InventoryValuationLayerReport,
  InventoryValuationMonetaryKardexReport,
  InventoryValuationUnresolvedReport,
} from "@argin/inventory/valuation-reports";
import type { InventoryValuationPolicySnapshot } from "@argin/inventory/valuation-policy";
import type { InventoryValuationTraceSnapshot } from "@argin/inventory/valuation-security";
import type {
  InventoryInboundCostCandidate,
  InventoryResolvedInboundCost,
} from "@argin/inventory-tauri";
import { gregorianToJalali } from "./inventory-persian-date";
import { valuationMethodLabel } from "./inventory-valuation-workspace-format";

function formatMoney(value: number | null, currency = "IRR"): string {
  if (value === null) return "نامشخص";
  return `${new Intl.NumberFormat("fa-IR").format(value)} ${currency}`;
}

type ValuationTableRow = (string | number)[];

interface ValuationTableProps {
  headers: string[];
  rows: ValuationTableRow[];
}

const ValuationTable = ({ headers, rows }: ValuationTableProps) => (
  <div className="valuation-table">
    <table>
      <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
      <tbody>{rows.map((row, rowIndex) => (
        <tr key={rowIndex}>{row.map((cell, columnIndex) => <td key={columnIndex}><bdi>{cell}</bdi></td>)}</tr>
      ))}</tbody>
    </table>
  </div>
);

export function ValuationOverviewPanel({ report }: { report: InventoryValuationAsOfReport }) {
  const tableRows: ValuationTableRow[] = report.rows.map((row) => [
    row.productId,row.warehouseId,gregorianToJalali(row.businessDate),valuationMethodLabel(row.method),
    row.quantity,formatMoney(row.totalCost,row.currency),row.totalCost === null || row.unresolvedCount ? "نامشخص" : "حل‌شده",
  ]);
  return <>
    <div className="valuation-cards">
      <article><span>ارزش حل‌شده</span><strong>{formatMoney(report.resolvedTotalCost)}</strong></article>
      <article><span>ردیف نامشخص</span><strong>{report.unresolvedRowCount}</strong></article>
    </div>
    <ValuationTable headers={["کالا","انبار","تاریخ","روش","تعداد","ارزش","وضعیت"]} rows={tableRows} />
  </>;
}

export function ValuationKardexPanel({ report, onTrace, onNext }: {
  report: InventoryValuationMonetaryKardexReport;
  onTrace: (movementId: string) => void;
  onNext: (cursor: string) => void;
}) {
  return <>
    <div className="valuation-cards">
      <article><span>افتتاحیه</span><strong>{formatMoney(report.openingResolvedCost)}</strong></article>
      <article><span>مانده پایان صفحه</span><strong>{formatMoney(report.closingResolvedCost)}</strong></article>
    </div>
    <div className="valuation-table"><table>
      <thead><tr>{["تاریخ","Movement","تعداد","قیمت واحد","اثر ریالی","مانده ریالی","ردیابی"].map((header) => <th key={header}>{header}</th>)}</tr></thead>
      <tbody>{report.entries.map((row) => <tr key={row.valuationEntryId}>
        <td>{gregorianToJalali(row.businessDate)}</td><td><bdi>{row.movementId}</bdi></td><td>{row.quantity}</td>
        <td>{row.unitCost ?? "نامشخص"}</td><td>{formatMoney(row.monetaryDelta,row.currency)}</td><td>{formatMoney(row.runningResolvedCost,row.currency)}</td>
        <td><button onClick={() => onTrace(row.movementId)}>منشأ</button></td>
      </tr>)}</tbody>
    </table></div>
    {report.nextCursor && <button className="valuation-more" onClick={() => onNext(report.nextCursor!)}>صفحه بعد</button>}
  </>;
}

export function ValuationLayersPanel({ report }: { report: InventoryValuationLayerReport }) {
  const tableRows: ValuationTableRow[] = report.rows.map((row) => [
    gregorianToJalali(row.openedBusinessDate),row.productId,row.warehouseId,row.originalQuantity,
    row.remainingQuantity,row.unitCost,formatMoney(row.remainingCost,row.currency),
  ]);
  return <>
    <p className="valuation-note">این جدول فقط لایه‌های باز فعلی FIFO را نشان می‌دهد و گزارش تاریخی As-of نیست.</p>
    <ValuationTable headers={["تاریخ","کالا","انبار","مقدار اولیه","باقی‌مانده","قیمت واحد","ارزش باقی‌مانده"]} rows={tableRows} />
  </>;
}

type InboundCostDisplayCandidate = InventoryInboundCostCandidate & {
  readonly documentLabel?: string;
  readonly productLabel?: string;
  readonly warehouseLabel?: string;
};

type ResolvedCostDisplay = InventoryResolvedInboundCost & {
  readonly documentLabel?: string;
  readonly productLabel?: string;
  readonly warehouseLabel?: string;
};

function ReadableLabel({ value, fallback, wide = false }: { value?: string; fallback: string; wide?: boolean }) {
  const label = value ?? fallback;
  return <span
    className={`valuation-readable${wide ? " valuation-readable--wide" : ""}`}
    title={label}
    aria-label={label}
  >{label}</span>;
}

function CostFacts({ row }: { row: InboundCostDisplayCandidate | ResolvedCostDisplay }) {
  return <dl className="valuation-cost-dialog__facts">
    <div><dt>سند</dt><dd>{row.documentLabel ?? row.documentId}</dd></div>
    <div><dt>تاریخ سند</dt><dd>{gregorianToJalali(row.businessDate)}</dd></div>
    <div className="valuation-cost-dialog__fact--wide"><dt>کالا</dt><dd>{row.productLabel ?? row.productId}</dd></div>
    <div className="valuation-cost-dialog__fact--wide"><dt>انبار</dt><dd>{row.warehouseLabel ?? row.warehouseId}</dd></div>
    <div><dt>تعداد</dt><dd>{row.quantity}</dd></div>
    <div><dt>روش</dt><dd>{row.method ? valuationMethodLabel(row.method) : "سیاست تعیین نشده"}</dd></div>
    <div><dt>ارز</dt><dd>{row.currency}</dd></div>
    <div><dt>منبع بها</dt><dd>ثبت دستی</dd></div>
  </dl>;
}

export function ValuationInboundCostPanel({ rows, canResolve, saving, onSetCost }: {
  rows: readonly InboundCostDisplayCandidate[];
  canResolve: boolean;
  saving: boolean;
  onSetCost: (row: InventoryInboundCostCandidate, unitCost: string) => Promise<void>;
}) {
  const [selectedRow,setSelectedRow] = useState<InboundCostDisplayCandidate | null>(null);
  const [unitCost,setUnitCost] = useState("");
  const close = () => { if (!saving) { setSelectedRow(null); setUnitCost(""); } };

  async function submitCost() {
    if (!selectedRow || !unitCost.trim()) return;
    await onSetCost(selectedRow,unitCost);
    setSelectedRow(null); setUnitCost("");
  }

  return <section className="valuation-section valuation-cost-inputs">
    <div className="valuation-section__head">
      <div><h3>ورودی‌های قطعی‌شده با بهای تعیین‌نشده</h3><p>این مبلغ «بهای خرید/ورودی موجودی» است، نه قیمت فروش. رسیدهای قدیمی و جدید هر دو از همین مسیر قابل تکمیل هستند.</p></div>
      <span className="valuation-count">{rows.length} ردیف</span>
    </div>
    {rows.length === 0 ? <p className="valuation-empty">ورودی قطعی‌شده‌ای با بهای تعیین‌نشده در محدوده انتخاب‌شده وجود ندارد.</p> :
      <div className="valuation-table valuation-table--cost-inputs valuation-table--compact"><table>
        <thead><tr>{["تاریخ","سند","کالا","انبار","تعداد","وضعیت","عملیات"].map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.movementId}>
          <td className="valuation-date-cell">{gregorianToJalali(row.businessDate)}</td>
          <td><ReadableLabel value={row.documentLabel} fallback={row.documentId} /></td>
          <td><ReadableLabel value={row.productLabel} fallback={row.productId} wide /></td>
          <td><ReadableLabel value={row.warehouseLabel} fallback={row.warehouseId} /></td>
          <td className="valuation-number-cell">{row.quantity}</td>
          <td><span className="valuation-unresolved-badge">بهای تعیین‌نشده</span></td>
          <td className="valuation-action-cell">{canResolve
            ? <button className="valuation-primary-action" onClick={() => {setSelectedRow(row);setUnitCost("");}}>تعیین بها</button>
            : <span className="valuation-muted">بدون مجوز</span>}</td>
        </tr>)}</tbody>
      </table></div>}

    <Dialog open={Boolean(selectedRow)} title="تعیین بهای خرید/ورودی" labelledBy="valuation-inbound-cost-title" onClose={close}
      footer={<><button type="button" onClick={close} disabled={saving}>انصراف</button><button type="button" className="valuation-dialog-submit" disabled={saving || !unitCost.trim()} onClick={() => void submitCost()}>{saving ? "در حال ثبت…" : "ثبت بهای ورودی"}</button></>}>
      {selectedRow && <div className="valuation-cost-dialog">
        <p className="valuation-cost-dialog__hint">تاریخ مبنا همان تاریخ قطعی سند انبار است. این عدد مبنای بهای تمام‌شده موجودی است و برای قیمت فروش استفاده نمی‌شود.</p>
        <CostFacts row={selectedRow} />
        <label className="valuation-cost-dialog__field">بهای خرید/ورودی هر واحد
          <input autoFocus dir="ltr" inputMode="decimal" placeholder="مثلاً 12000000" value={unitCost} onChange={(event) => setUnitCost(event.target.value.replace(/,/gu,""))} disabled={saving} />
          <small>بهای کل با مقدار سند محاسبه می‌شود. در آینده فاکتور خرید می‌تواند همین Cost Input را به‌صورت خودکار تأمین کند.</small>
        </label>
      </div>}
    </Dialog>
  </section>;
}

export function ValuationRegisteredCostPanel({ rows, canCorrect, saving, onCorrectCost }: {
  rows: readonly ResolvedCostDisplay[];
  canCorrect: boolean;
  saving: boolean;
  onCorrectCost: (row: ResolvedCostDisplay, unitCost: string, reason: string) => Promise<void>;
}) {
  const [selectedRow,setSelectedRow] = useState<ResolvedCostDisplay | null>(null);
  const [unitCost,setUnitCost] = useState("");
  const [reason,setReason] = useState("");
  const close = () => { if (!saving) {setSelectedRow(null);setUnitCost("");setReason("");} };

  async function submitCorrection() {
    if (!selectedRow || !unitCost.trim() || !reason.trim()) return;
    await onCorrectCost(selectedRow,unitCost,reason);
    setSelectedRow(null); setUnitCost(""); setReason("");
  }

  return <section className="valuation-section valuation-registered-costs">
    <div className="valuation-section__head">
      <div><h3>بهای خرید/ورودی ثبت‌شده</h3><p>مبالغ فعلی هر رسید را اینجا بررسی کنید. تغییر قیمت بازار یا قیمت فروش از این بخش انجام نمی‌شود.</p></div>
      <span className="valuation-count">{rows.length} ردیف</span>
    </div>
    {rows.length === 0 ? <p className="valuation-empty">هنوز بهای ورودی ثبت‌شده‌ای در محدوده انتخاب‌شده وجود ندارد.</p> :
      <div className="valuation-table valuation-table--registered valuation-table--compact"><table>
        <thead><tr>{["تاریخ","سند","کالا","انبار","تعداد","بهای واحد","بهای کل","عملیات"].map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.basisLineId}>
          <td className="valuation-date-cell">{gregorianToJalali(row.businessDate)}</td>
          <td><ReadableLabel value={row.documentLabel} fallback={row.documentId} /></td>
          <td><ReadableLabel value={row.productLabel} fallback={row.productId} wide /></td>
          <td><ReadableLabel value={row.warehouseLabel} fallback={row.warehouseId} /></td>
          <td className="valuation-number-cell">{row.quantity}</td>
          <td className="valuation-money-cell">{formatMoney(Number(row.unitCost),row.currency)}</td>
          <td className="valuation-money-cell">{formatMoney(row.totalCost,row.currency)}</td>
          <td className="valuation-action-cell">{canCorrect
            ? <button className="valuation-secondary-action" onClick={() => {setSelectedRow(row);setUnitCost(row.unitCost);setReason("");}}>اصلاح بها</button>
            : <span className="valuation-muted">فقط مشاهده</span>}</td>
        </tr>)}</tbody>
      </table></div>}

    <Dialog open={Boolean(selectedRow)} title="اصلاح بهای خرید/ورودی" labelledBy="valuation-inbound-cost-correction-title" onClose={close}
      footer={<><button type="button" onClick={close} disabled={saving}>انصراف</button><button type="button" className="valuation-dialog-submit" disabled={saving || !unitCost.trim() || !reason.trim()} onClick={() => void submitCorrection()}>{saving ? "در حال اصلاح…" : "ثبت اصلاح بها"}</button></>}>
      {selectedRow && <div className="valuation-cost-dialog">
        <p className="valuation-cost-dialog__hint valuation-cost-dialog__hint--warning">اصلاح بها فقط برای تصحیح بهای خرید/ورودی همان رسید است؛ مثلاً ثبت اشتباه یا قطعی‌شدن مبلغ فاکتور تأمین‌کننده. افزایش قیمت فروش یا قیمت خریدهای آینده نباید بهای این رسید تاریخی را تغییر دهد.</p>
        <CostFacts row={selectedRow} />
        <div className="valuation-current-cost"><span>بهای فعلی</span><strong>{formatMoney(Number(selectedRow.unitCost),selectedRow.currency)}</strong><small>Revision {selectedRow.revision}</small></div>
        <label className="valuation-cost-dialog__field">بهای صحیح هر واحد
          <input autoFocus dir="ltr" inputMode="decimal" value={unitCost} onChange={(event) => setUnitCost(event.target.value.replace(/,/gu,""))} disabled={saving} />
        </label>
        <label className="valuation-cost-dialog__field">دلیل اصلاح
          <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="مثلاً: اصلاح طبق فاکتور نهایی تأمین‌کننده" disabled={saving} />
          <small>دلیل اصلاح اجباری است تا تغییر بهای تاریخی قابل ردیابی باشد.</small>
        </label>
      </div>}
    </Dialog>
  </section>;
}

export function ValuationUnresolvedPanel({ report }: { report: InventoryValuationUnresolvedReport }) {
  const tableRows: ValuationTableRow[] = report.rows.map((row) => [gregorianToJalali(row.businessDate),row.productId,row.warehouseId,row.quantity,valuationMethodLabel(row.method),row.reason]);
  return <section className="valuation-section"><div className="valuation-section__head"><h3>موارد حل‌نشده موتور ارزش‌گذاری</h3><span className="valuation-count">{report.rows.length} ردیف</span></div><ValuationTable headers={["تاریخ","کالا","انبار","تعداد","روش","علت"]} rows={tableRows} /></section>;
}

export function ValuationPolicyPanel({ rows, readOnly }: { rows: readonly InventoryValuationPolicySnapshot[]; readOnly: boolean }) {
  const tableRows: ValuationTableRow[] = rows.map((policy) => [gregorianToJalali(policy.effectiveFrom),valuationMethodLabel(policy.method),policy.currency,policy.strategyVersion,policy.revision,policy.changeReason ?? (policy.previousPolicyId ? "تغییر سیاست" : "سیاست اولیه")]);
  return <><ValuationTable headers={["از تاریخ","روش","ارز","نسخه موتور","Revision","علت تغییر"]} rows={tableRows} />{readOnly && <p className="valuation-note">تغییر سیاست نیازمند مجوز مدیریت ارزش‌گذاری است.</p>}</>;
}

export function ValuationTracePanel({ trace, onClose }: { trace: InventoryValuationTraceSnapshot; onClose: () => void }) {
  return <aside className="valuation-trace"><button onClick={onClose}>بستن</button><h3>ردیابی منشأ ارزش‌گذاری</h3><p>Movement: <bdi>{trace.movementId}</bdi></p><p>Policy: {valuationMethodLabel(trace.policy.method)} / Revision {trace.policy.revision}</p><p>Cost Input: {trace.costInput ? formatMoney(trace.costInput.totalCost,trace.costInput.currency) : "ندارد"}</p><p>Valuation Entry: {trace.entry ? formatMoney(trace.entry.totalCost,trace.entry.currency) : "ایجاد نشده"}</p></aside>;
}