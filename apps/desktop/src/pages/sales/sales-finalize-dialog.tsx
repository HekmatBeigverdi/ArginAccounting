import { useEffect, useMemo, useRef, useState } from "react";
import type { BelowCostEvaluation, BelowCostLineRouting, BelowCostSalesMode } from "@argin/sales";
import type { WarehouseListItemDto } from "@argin/warehouse";
import type { SalesWorkspaceDocument } from "../../composition/sales/create-sales-workspace-services";
import { Feedback } from "../../components/feedback";
import "./sales-document-form.css";

export interface BelowCostPreviewResult {
  readonly policy: {
    readonly mode: BelowCostSalesMode;
    readonly minimumMarginBasisPoints: number;
  };
  readonly results: readonly {
    readonly snapshot: {
      readonly lineId: string;
      readonly productId: string;
    };
    readonly evaluation: BelowCostEvaluation;
  }[];
}

interface Props {
  document: SalesWorkspaceDocument;
  warehouses: readonly WarehouseListItemDto[];
  busy: boolean;
  canApproveBelowCost: boolean;
  guardEnabled: boolean;
  preview(routing: readonly BelowCostLineRouting[]): Promise<BelowCostPreviewResult>;
  onConfirm(input: {
    routing: readonly BelowCostLineRouting[];
    acknowledgeWarning: boolean;
    approvalReason: string | null;
  }): void;
  onClose(): void;
}

const money = new Intl.NumberFormat("fa-IR");
const OUTCOME_LABELS: Record<BelowCostEvaluation["outcome"], string> = {
  "not-applicable": "نامرتبط",
  "allowed": "مجاز",
  "warning": "هشدار",
  "approval-required": "نیازمند تأیید",
  "blocked": "مسدود",
  "cost-unavailable": "بهای معتبر در دسترس نیست",
};

export function SalesFinalizeDialog({
  document,
  warehouses,
  busy,
  canApproveBelowCost,
  guardEnabled,
  preview,
  onConfirm,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stockLines = document.lines.filter(line => line.lineKind === "stock-product");
  const isReturn = document.documentType === "sales-return";
  const warehouseLabel = isReturn ? "انبار دریافت" : "انبار خروج";

  const [routing, setRouting] = useState<Record<string, string>>(() => {
    const defaultWarehouseId = warehouses.length === 1 ? warehouses[0]!.warehouseId : "";
    return Object.fromEntries(stockLines.map(line => [line.lineId, defaultWarehouseId]));
  });
  const [result, setResult] = useState<BelowCostPreviewResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);
  const [approvalReason, setApprovalReason] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const routeArray = useMemo(
    () => stockLines.map(line => ({
      salesLineId: line.lineId,
      warehouseId: routing[line.lineId] ?? "",
    })),
    [stockLines, routing],
  );
  const routingIncomplete = routeArray.some(route => !route.warehouseId);
  const outcomes = result?.results.map(item => item.evaluation.outcome) ?? [];
  const blocked = outcomes.includes("blocked") || outcomes.includes("cost-unavailable");
  const hasWarning = outcomes.includes("warning");
  const requiresApproval = outcomes.includes("approval-required");
  const warningSatisfied = !hasWarning || warningAcknowledged;
  const approvalSatisfied = !requiresApproval
    || (canApproveBelowCost && approvalReason.trim().length > 0);
  const canFinalize = guardEnabled
    ? Boolean(result) && !blocked && warningSatisfied && approvalSatisfied
    : !routingIncomplete;

  async function runPreview() {
    if (routingIncomplete) {
      setError("برای هر کالای انبارشونده انبار خروج را انتخاب کنید.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setWarningAcknowledged(false);

    try {
      setResult(await preview(routeArray));
    } catch (error) {
      setError(error instanceof Error ? error.message : "بررسی بهای تمام‌شده ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="sales-document-form sales-finalize-dialog"
      dir="rtl"
      onCancel={event => {
        event.preventDefault();
        if (!busy && !loading) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={event => {
          event.preventDefault();
          if (canFinalize) {
            onConfirm({
              routing: routeArray,
              acknowledgeWarning: warningAcknowledged,
              approvalReason: requiresApproval ? approvalReason.trim() : null,
            });
          }
        }}
      >
        <h2>قطعی‌کردن فاکتور فروش</h2>
        <p>
          {guardEnabled
            ? "قبل از قطعی‌سازی، انبار خروج و سیاست فروش زیر بهای تمام‌شده بر اساس ارزش‌گذاری معتبر موجودی بررسی می‌شود."
            : "برای ردیف‌های کالای انبارشونده، انبار مرتبط را انتخاب کنید تا سند انبار متناظر ایجاد شود."}
        </p>

        {error && <Feedback tone="error">{error}</Feedback>}

        {stockLines.map(line => (
          <label key={line.lineId}>
            {warehouseLabel} — {line.description || line.item.productId}
            <select
              value={routing[line.lineId] ?? ""}
              disabled={busy || loading}
              onChange={event => {
                setRouting(current => ({ ...current, [line.lineId]: event.target.value }));
                setResult(null);
              }}
            >
              <option value="">انتخاب انبار…</option>
              {warehouses.map(warehouse => (
                <option key={warehouse.warehouseId} value={warehouse.warehouseId}>
                  {warehouse.code} — {warehouse.title}
                </option>
              ))}
            </select>
          </label>
        ))}

        {guardEnabled && !result && (
          <button
            type="button"
            onClick={() => void runPreview()}
            disabled={busy || loading || routingIncomplete}
          >
            {loading ? "در حال بررسی…" : "بررسی بهای تمام‌شده و سیاست فروش"}
          </button>
        )}

        {result && (
          <div className="sales-below-cost-preview">
            <strong>
              سیاست: {result.policy.mode} · حداقل حاشیه {result.policy.minimumMarginBasisPoints / 100}%
            </strong>
            <table>
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>قیمت خالص واحد (قبل از VAT)</th>
                  <th>بهای مبنا</th>
                  <th>حاشیه</th>
                  <th>نتیجه</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map(({ snapshot, evaluation }) => (
                  <tr key={snapshot.lineId}>
                    <td dir="ltr">{snapshot.productId}</td>
                    <td dir="ltr">{money.format(evaluation.sellingUnitPrice)}</td>
                    <td dir="ltr">{evaluation.costUnitPrice ?? "—"}</td>
                    <td dir="ltr">
                      {evaluation.marginAmount == null ? "—" : money.format(evaluation.marginAmount)}{" "}
                      {evaluation.marginBasisPoints == null
                        ? ""
                        : `(${evaluation.marginBasisPoints / 100}%)`}
                    </td>
                    <td>{OUTCOME_LABELS[evaluation.outcome]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasWarning && (
          <label className="sales-finalize-dialog__ack">
            <input
              type="checkbox"
              checked={warningAcknowledged}
              onChange={event => setWarningAcknowledged(event.target.checked)}
            />{" "}
            هشدار فروش زیر حد مجاز را مشاهده کردم و ادامه می‌دهم.
          </label>
        )}

        {requiresApproval && (
          <>
            {!canApproveBelowCost && (
              <Feedback tone="warning">
                این فاکتور نیازمند مجوز «تأیید فروش زیر بهای تمام‌شده» است.
              </Feedback>
            )}
            {canApproveBelowCost && (
              <label>
                دلیل تأیید فروش زیر حد مجاز
                <textarea
                  value={approvalReason}
                  onChange={event => setApprovalReason(event.target.value)}
                  rows={3}
                />
              </label>
            )}
          </>
        )}

        {blocked && (
          <Feedback tone="error">
            طبق سیاست شرکت یا وضعیت ارزش‌گذاری، این فاکتور در حال حاضر قابل قطعی‌کردن نیست.
          </Feedback>
        )}

        <footer>
          <button className="primary" type="submit" disabled={busy || loading || !canFinalize}>
            {busy ? "در حال ثبت…" : "قطعی‌کردن"}
          </button>
          <button type="button" disabled={busy || loading} onClick={onClose}>
            انصراف
          </button>
        </footer>
      </form>
    </dialog>
  );
}
