import type {
  SalesPostingRecoverySnapshot,
  SalesPostingTraceSnapshot,
} from "@argin/sales-posting";

import {
  createSalesPostingRecoveryViewModel,
} from "../../features/sales/sales-posting-recovery-view";
import "./sales-posting-recovery-panel.css";

export interface SalesPostingRecoveryPanelProps {
  readonly recovery: SalesPostingRecoverySnapshot;
  readonly trace?: SalesPostingTraceSnapshot | null;
  readonly canRecover: boolean;
  readonly canViewTrace: boolean;
  readonly busy?: boolean;
  readonly onRecover?: () => void;
  readonly onRefresh?: () => void;
}

const numberFormatter = new Intl.NumberFormat("fa-IR");

export function SalesPostingRecoveryPanel(
  props: SalesPostingRecoveryPanelProps,
) {
  const view = createSalesPostingRecoveryViewModel(props.recovery);
  const showAction =
    view.actionLabel !== null
    && props.canRecover
    && props.onRecover !== undefined;

  return (
    <section
      className={"sales-posting-recovery sales-posting-recovery--" + view.statusTone}
      dir="rtl"
      aria-label="وضعیت ثبت حسابداری فروش"
    >
      <header className="sales-posting-recovery__header">
        <div>
          <h3>ثبت حسابداری فروش</h3>
          <p>وضعیت ثبت، بازیابی و مسیر ردیابی اثر حسابداری این سند</p>
        </div>
        {props.onRefresh && (
          <button
            type="button"
            disabled={props.busy}
            onClick={props.onRefresh}
          >
            {props.busy ? "در حال بازخوانی…" : "بازخوانی وضعیت"}
          </button>
        )}
      </header>

      <div className="sales-posting-recovery__summary">
        <div>
          <span>وضعیت</span>
          <strong>{view.statusLabel}</strong>
        </div>
        <div>
          <span>اقدام پیشنهادی</span>
          <strong>{view.actionLabel ?? "نیازی به اقدام نیست"}</strong>
        </div>
        <div>
          <span>سند حسابداری</span>
          <strong dir="ltr">{view.journalVoucherId ?? "—"}</strong>
        </div>
        <div>
          <span>نسخه ثبت</span>
          <strong>
            {view.committedPostingVersion === null
              ? "—"
              : numberFormatter.format(view.committedPostingVersion)}
          </strong>
        </div>
      </div>

      <div className="sales-posting-recovery__message">
        <strong>{view.statusLabel}</strong>
        <span>{view.explanation}</span>
        {view.reasonLabel && (
          <small>
            علت: {view.reasonLabel}
          </small>
        )}
      </div>

      {view.waitingLineIds.length > 0 && (
        <div className="sales-posting-recovery__waiting">
          <span>ردیف‌های در انتظار:</span>
          <div>
            {view.waitingLineIds.map((lineId) => (
              <bdi key={lineId}>{lineId}</bdi>
            ))}
          </div>
        </div>
      )}

      {showAction && (
        <div className="sales-posting-recovery__actions">
          <button
            type="button"
            className="primary"
            disabled={props.busy}
            onClick={props.onRecover}
          >
            {props.busy ? "در حال انجام…" : view.actionLabel}
          </button>
        </div>
      )}

      {props.canViewTrace && props.trace && (
        <details className="sales-posting-recovery__trace">
          <summary>نمایش مسیر ردیابی عملیاتی</summary>
          <dl>
            <dt>Posting ID</dt>
            <dd><bdi>{props.trace.postingId}</bdi></dd>
            <dt>نسخه Posting</dt>
            <dd>{numberFormatter.format(props.trace.postingVersion)}</dd>
            <dt>سند منبع</dt>
            <dd><bdi>{props.trace.source.sourceDocumentId}</bdi></dd>
            <dt>نسخه منبع</dt>
            <dd>{numberFormatter.format(props.trace.source.sourceVersion)}</dd>
            <dt>Journal Voucher</dt>
            <dd><bdi>{props.trace.journalVoucherId ?? "—"}</bdi></dd>
            <dt>Request ID</dt>
            <dd><bdi>{props.trace.requestId}</bdi></dd>
            <dt>Operation ID</dt>
            <dd><bdi>{props.trace.operationId}</bdi></dd>
            <dt>Correlation ID</dt>
            <dd><bdi>{props.trace.correlationId}</bdi></dd>
            <dt>Causation ID</dt>
            <dd><bdi>{props.trace.causationId ?? "—"}</bdi></dd>
          </dl>
        </details>
      )}
    </section>
  );
}
