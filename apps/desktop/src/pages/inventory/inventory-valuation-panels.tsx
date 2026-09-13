import type {
  InventoryValuationAsOfReport,
  InventoryValuationLayerReport,
  InventoryValuationMonetaryKardexReport,
  InventoryValuationUnresolvedReport,
} from "@argin/inventory/valuation-reports";
import type { InventoryValuationPolicySnapshot } from "@argin/inventory/valuation-policy";
import type { InventoryValuationTraceSnapshot } from "@argin/inventory/valuation-security";
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
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, columnIndex) => (
              <td key={columnIndex}>
                <bdi>{cell}</bdi>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export function ValuationOverviewPanel({
  report,
}: {
  report: InventoryValuationAsOfReport;
}) {
  const tableRows: ValuationTableRow[] = report.rows.map((row) => [
    row.productId,
    row.warehouseId,
    gregorianToJalali(row.businessDate),
    valuationMethodLabel(row.method),
    row.quantity,
    formatMoney(row.totalCost, row.currency),
    row.totalCost === null || row.unresolvedCount ? "نامشخص" : "حل‌شده",
  ]);

  return (
    <>
      <div className="valuation-cards">
        <article>
          <span>ارزش حل‌شده</span>
          <strong>{formatMoney(report.resolvedTotalCost)}</strong>
        </article>
        <article>
          <span>ردیف نامشخص</span>
          <strong>{report.unresolvedRowCount}</strong>
        </article>
      </div>
      <ValuationTable
        headers={["کالا", "انبار", "تاریخ", "روش", "تعداد", "ارزش", "وضعیت"]}
        rows={tableRows}
      />
    </>
  );
}

export function ValuationKardexPanel({
  report,
  onTrace,
  onNext,
}: {
  report: InventoryValuationMonetaryKardexReport;
  onTrace: (movementId: string) => void;
  onNext: (cursor: string) => void;
}) {
  return (
    <>
      <div className="valuation-cards">
        <article>
          <span>افتتاحیه</span>
          <strong>{formatMoney(report.openingResolvedCost)}</strong>
        </article>
        <article>
          <span>مانده پایان صفحه</span>
          <strong>{formatMoney(report.closingResolvedCost)}</strong>
        </article>
      </div>
      <div className="valuation-table">
        <table>
          <thead>
            <tr>
              {[
                "تاریخ",
                "Movement",
                "تعداد",
                "قیمت واحد",
                "اثر ریالی",
                "مانده ریالی",
                "ردیابی",
              ].map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.entries.map((row) => (
              <tr key={row.valuationEntryId}>
                <td>{gregorianToJalali(row.businessDate)}</td>
                <td>
                  <bdi>{row.movementId}</bdi>
                </td>
                <td>{row.quantity}</td>
                <td>{row.unitCost ?? "نامشخص"}</td>
                <td>{formatMoney(row.monetaryDelta, row.currency)}</td>
                <td>{formatMoney(row.runningResolvedCost, row.currency)}</td>
                <td>
                  <button onClick={() => onTrace(row.movementId)}>منشأ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {report.nextCursor && (
        <button
          className="valuation-more"
          onClick={() => onNext(report.nextCursor!)}
        >
          صفحه بعد
        </button>
      )}
    </>
  );
}

export function ValuationLayersPanel({
  report,
}: {
  report: InventoryValuationLayerReport;
}) {
  const tableRows: ValuationTableRow[] = report.rows.map((row) => [
    gregorianToJalali(row.openedBusinessDate),
    row.productId,
    row.warehouseId,
    row.originalQuantity,
    row.remainingQuantity,
    row.unitCost,
    formatMoney(row.remainingCost, row.currency),
  ]);

  return (
    <>
      <p className="valuation-note">
        {
          "این جدول فقط لایه‌های باز فعلی FIFO را نشان می‌دهد و گزارش تاریخی As-of نیست."
        }
      </p>
      <ValuationTable
        headers={[
          "تاریخ",
          "کالا",
          "انبار",
          "مقدار اولیه",
          "باقی‌مانده",
          "قیمت واحد",
          "ارزش باقی‌مانده",
        ]}
        rows={tableRows}
      />
    </>
  );
}

export function ValuationUnresolvedPanel({
  report,
}: {
  report: InventoryValuationUnresolvedReport;
}) {
  const tableRows: ValuationTableRow[] = report.rows.map((row) => [
    gregorianToJalali(row.businessDate),
    row.productId,
    row.warehouseId,
    row.quantity,
    valuationMethodLabel(row.method),
    row.reason,
  ]);

  return (
    <ValuationTable
      headers={["تاریخ", "کالا", "انبار", "تعداد", "روش", "علت"]}
      rows={tableRows}
    />
  );
}

export function ValuationPolicyPanel({
  rows,
  readOnly,
}: {
  rows: readonly InventoryValuationPolicySnapshot[];
  readOnly: boolean;
}) {
  const tableRows: ValuationTableRow[] = rows.map((policy) => [
    gregorianToJalali(policy.effectiveFrom),
    valuationMethodLabel(policy.method),
    policy.currency,
    policy.strategyVersion,
    policy.revision,
    policy.changeReason ??
      (policy.previousPolicyId ? "تغییر سیاست" : "سیاست اولیه"),
  ]);

  return (
    <>
      <ValuationTable
        headers={[
          "از تاریخ",
          "روش",
          "ارز",
          "نسخه موتور",
          "Revision",
          "علت تغییر",
        ]}
        rows={tableRows}
      />
      {readOnly && (
        <p className="valuation-note">
          تغییر سیاست نیازمند مجوز مدیریت ارزش‌گذاری است.
        </p>
      )}
    </>
  );
}

export function ValuationTracePanel({
  trace,
  onClose,
}: {
  trace: InventoryValuationTraceSnapshot;
  onClose: () => void;
}) {
  return (
    <aside className="valuation-trace">
      <button onClick={onClose}>بستن</button>
      <h3>ردیابی منشأ ارزش‌گذاری</h3>
      <p>
        Movement: <bdi>{trace.movementId}</bdi>
      </p>
      <p>
        Policy: {valuationMethodLabel(trace.policy.method)} / Revision{" "}
        {trace.policy.revision}
      </p>
      <p>
        Cost Input:{" "}
        {trace.costInput
          ? formatMoney(trace.costInput.totalCost, trace.costInput.currency)
          : "ندارد"}
      </p>
      <p>
        Valuation Entry:{" "}
        {trace.entry
          ? formatMoney(trace.entry.totalCost, trace.entry.currency)
          : "ایجاد نشده"}
      </p>
    </aside>
  );
}
