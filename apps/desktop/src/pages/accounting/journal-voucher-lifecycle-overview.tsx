import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import type {
  JournalVoucherLifecycleActionCapability,
  JournalVoucherLifecycleDto,
  JournalVoucherListItemDto,
} from "@argin/accounting/journal";
import type { Company } from "@argin/company";
import { SqliteCompanyRepository } from "@argin/company-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useAuthSession } from "../../app/providers/auth-session-provider";
import { PersianDatePicker } from "../../components/forms";
import { useAccountingServices } from "../../composition/accounting/accounting-provider";
import { formatJournalVoucherDate } from "../../features/accounting/journal-voucher-presenter";
import {
  presentJournalVoucherLifecycle,
  presentJournalVoucherLifecycleFailure,
  type JournalVoucherLifecycleActionView,
  type JournalVoucherLifecyclePresentedFailure,
} from "../../features/accounting/journal-voucher-lifecycle-presenter";

import "./journal-voucher-lifecycle-overview.css";

interface LifecycleRow {
  readonly voucher: JournalVoucherListItemDto;
  readonly lifecycle: JournalVoucherLifecycleDto;
}

type PendingAction =
  | { readonly kind: "post"; readonly row: LifecycleRow; readonly action: JournalVoucherLifecycleActionView }
  | { readonly kind: "reverse"; readonly row: LifecycleRow; readonly action: JournalVoucherLifecycleActionView };

const today = () => new Date().toISOString().slice(0, 10);

export function JournalVoucherLifecycleOverview() {
  const { journals, journalLifecycle } = useAccountingServices();
  const { session } = useAuthSession();
  const [companies, setCompanies] = useState<readonly Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [rows, setRows] = useState<readonly LifecycleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<JournalVoucherLifecyclePresentedFailure | null>(null);
  const [message, setMessage] = useState("");
  const [expandedVoucherId, setExpandedVoucherId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [postingReference, setPostingReference] = useState("");
  const [reversalDate, setReversalDate] = useState(today());
  const [reversalReason, setReversalReason] = useState("");
  const permissions = useMemo(
    () => new Set(session?.user.permissions ?? []),
    [session],
  );

  useEffect(() => {
    void getDesktopDatabase()
      .then((database) => new SqliteCompanyRepository(database).findAll())
      .then((values) => {
        setCompanies(values);
        setCompanyId((current) => current || values[0]?.id || "");
      })
      .catch((reason: unknown) => setFailure(presentJournalVoucherLifecycleFailure(reason)));
  }, []);

  const load = useCallback(async () => {
    if (!companyId) {
      setRows([]);
      return;
    }

    setBusy(true);
    setFailure(null);
    try {
      const page = await journals.search({ companyId, page: 1, pageSize: 30 });
      const values = await Promise.all(
        page.items.map(async (voucher) => ({
          voucher,
          lifecycle: await journalLifecycle.get(companyId, voucher.id),
        })),
      );
      setRows(Object.freeze(values));
    } catch (reason) {
      setFailure(presentJournalVoucherLifecycleFailure(reason));
    } finally {
      setBusy(false);
    }
  }, [companyId, journalLifecycle, journals]);

  useEffect(() => {
    void load();
  }, [load]);

  const openHighImpactAction = useCallback((
    row: LifecycleRow,
    action: JournalVoucherLifecycleActionView,
  ) => {
    if (action.action !== "post" && action.action !== "reverse") return;
    setFailure(null);
    setMessage("");
    setPostingReference("");
    setReversalDate(today());
    setReversalReason("");
    setPendingAction({ kind: action.action, row, action });
  }, []);

  const executePendingAction = useCallback(async () => {
    if (!pendingAction || !session?.user.id) return;
    if (pendingAction.action.confirmation && !window.confirm(pendingAction.action.confirmation)) return;
    if (pendingAction.kind === "reverse" && !reversalReason.trim()) {
      setFailure({
        kind: "business",
        title: "دلیل برگشت الزامی است",
        message: "برای ایجاد سند برگشتی باید دلیل روشن و قابل رهگیری ثبت شود.",
        technical: null,
      });
      return;
    }

    setBusy(true);
    setFailure(null);
    setMessage("");
    try {
      const correlationId = crypto.randomUUID();
      const occurredAt = new Date().toISOString();
      if (pendingAction.kind === "post") {
        const result = await journalLifecycle.post({
          context: {
            actorId: session.user.id,
            companyId: pendingAction.row.lifecycle.companyId,
            requestId: crypto.randomUUID(),
            correlationId,
            occurredAt,
          },
          voucherId: pendingAction.row.lifecycle.voucherId,
          expectedVersion: pendingAction.row.lifecycle.version,
          ...(postingReference.trim() ? { postingReference: postingReference.trim() } : {}),
        });
        setMessage(`سند ${pendingAction.row.voucher.number} با موفقیت ثبت نهایی شد (نسخه ${result.voucher.version.toLocaleString("fa-IR")}).`);
      } else {
        const result = await journalLifecycle.reverse({
          context: {
            actorId: session.user.id,
            companyId: pendingAction.row.lifecycle.companyId,
            requestId: crypto.randomUUID(),
            correlationId,
            occurredAt,
          },
          voucherId: pendingAction.row.lifecycle.voucherId,
          expectedVersion: pendingAction.row.lifecycle.version,
          reversalDate,
          reason: reversalReason.trim(),
        });
        setMessage(
          result.replayed
            ? "درخواست برگشت قبلاً ثبت شده بود و نتیجه موجود بازیابی شد."
            : `سند برگشتی ${result.reversalVoucher.number} ایجاد و سند اصلی برگشت شد.`,
        );
      }
      setPendingAction(null);
      await load();
    } catch (reason) {
      setFailure(presentJournalVoucherLifecycleFailure(reason));
    } finally {
      setBusy(false);
    }
  }, [journalLifecycle, load, pendingAction, postingReference, reversalDate, reversalReason, session]);

  return (
    <section
      className="journal-lifecycle-overview"
      dir="rtl"
      lang="fa"
      aria-labelledby="journal-lifecycle-title"
    >
      <div className="journal-lifecycle-overview__header">
        <div>
          <p className="journal-lifecycle-overview__eyebrow">چرخه عمر سند</p>
          <h2 id="journal-lifecycle-title">وضعیت، ثبت نهایی و رهگیری</h2>
          <p>ثبت نهایی و برگشت از Application اجرا می‌شوند؛ وضعیت و شواهد پس از هر عملیات دوباره از پایگاه داده خوانده می‌شوند.</p>
        </div>
        <div className="journal-lifecycle-overview__filters">
          <label>
            شرکت
            <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.legalName}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={busy} onClick={() => void load()}>
            {busy ? "در حال تازه‌سازی…" : "تازه‌سازی وضعیت"}
          </button>
        </div>
      </div>

      {failure && (
        <section
          className={`journal-lifecycle-failure journal-lifecycle-failure--${failure.kind}`}
          role="alert"
        >
          <strong>{failure.title}</strong>
          <p>{failure.message}</p>
          {failure.technical && (
            <details>
              <summary>جزئیات فنی</summary>
              <code dir="ltr">{failure.technical}</code>
            </details>
          )}
        </section>
      )}
      {message && <p className="journal-lifecycle-success" role="status">{message}</p>}

      <div className="journal-lifecycle-overview__table-wrap">
        <table className="journal-lifecycle-overview__table">
          <thead>
            <tr>
              <th>سند</th>
              <th>تاریخ</th>
              <th>وضعیت</th>
              <th>قفل</th>
              <th>نسخه</th>
              <th>عملیات</th>
              <th>رهگیری</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { voucher, lifecycle } = row;
              const view = presentJournalVoucherLifecycle(lifecycle, permissions);
              const isExpanded = expandedVoucherId === voucher.id;
              return (
                <LifecycleTableRows
                  key={voucher.id}
                  row={row}
                  view={view}
                  expanded={isExpanded}
                  onToggleTrace={() => setExpandedVoucherId(isExpanded ? null : voucher.id)}
                  onHighImpactAction={openHighImpactAction}
                />
              );
            })}
            {!busy && rows.length === 0 && (
              <tr><td colSpan={7} className="journal-lifecycle-overview__empty">سندی برای نمایش وجود ندارد.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pendingAction && (
        <section className="journal-lifecycle-dialog-backdrop" role="presentation">
          <div
            className="journal-lifecycle-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-lifecycle-dialog-title"
          >
            <h3 id="journal-lifecycle-dialog-title">{pendingAction.action.label} سند {pendingAction.row.voucher.number}</h3>
            <p>{pendingAction.action.confirmation}</p>
            {pendingAction.kind === "post" ? (
              <label>
                مرجع ثبت نهایی (اختیاری)
                <input
                  value={postingReference}
                  maxLength={100}
                  onChange={(event) => setPostingReference(event.target.value)}
                  autoFocus
                />
              </label>
            ) : (
              <>
                <label>
                  تاریخ برگشت
                  <PersianDatePicker
                    value={reversalDate}
                    onChange={setReversalDate}
                    ariaLabel="تاریخ برگشت سند"
                  />
                </label>
                <label>
                  دلیل برگشت
                  <textarea
                    value={reversalReason}
                    maxLength={500}
                    rows={3}
                    onChange={(event) => setReversalReason(event.target.value)}
                    autoFocus
                  />
                </label>
              </>
            )}
            <div className="journal-lifecycle-dialog__actions">
              <button type="button" disabled={busy} onClick={() => setPendingAction(null)}>انصراف</button>
              <button
                type="button"
                className="journal-lifecycle-action-button journal-lifecycle-action-button--danger"
                disabled={busy || (pendingAction.kind === "reverse" && !reversalReason.trim())}
                onClick={() => void executePendingAction()}
              >
                {busy ? "در حال انجام…" : `تأیید ${pendingAction.action.label}`}
              </button>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}

function LifecycleTableRows({
  row,
  view,
  expanded,
  onToggleTrace,
  onHighImpactAction,
}: {
  row: LifecycleRow;
  view: ReturnType<typeof presentJournalVoucherLifecycle>;
  expanded: boolean;
  onToggleTrace: () => void;
  onHighImpactAction: (row: LifecycleRow, action: JournalVoucherLifecycleActionView) => void;
}) {
  return (
    <>
      <tr>
        <td><b dir="ltr">{row.voucher.number}</b></td>
        <td>{formatJournalVoucherDate(row.voucher.voucherDate)}</td>
        <td>
          <span className={`journal-lifecycle-status journal-lifecycle-status--${view.tone}`}>
            {view.statusLabel}
          </span>
          <small>{view.statusDescription}</small>
        </td>
        <td>{view.locked ? "قفل" : "قابل ویرایش"}</td>
        <td>{view.versionLabel}</td>
        <td>
          <div className="journal-lifecycle-actions" aria-label={`عملیات سند ${row.voucher.number}`}>
            {view.actions.map((action) => (
              <LifecycleAction
                key={action.action}
                row={row}
                action={action}
                onHighImpactAction={onHighImpactAction}
              />
            ))}
            {view.actions.length === 0 && <span className="journal-lifecycle-action--none">عملیات دیگری ندارد</span>}
          </div>
        </td>
        <td>
          <button type="button" className="journal-lifecycle-trace-toggle" onClick={onToggleTrace}>
            {expanded ? "بستن" : "مشاهده رهگیری"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="journal-lifecycle-trace-row">
          <td colSpan={7}><Traceability lifecycle={row.lifecycle} /></td>
        </tr>
      )}
    </>
  );
}

function LifecycleAction({
  row,
  action,
  onHighImpactAction,
}: {
  row: LifecycleRow;
  action: JournalVoucherLifecycleActionView;
  onHighImpactAction: (row: LifecycleRow, action: JournalVoucherLifecycleActionView) => void;
}) {
  if (action.action === "post" || action.action === "reverse") {
    return (
      <button
        type="button"
        className={`journal-lifecycle-action-button ${action.action === "reverse" ? "journal-lifecycle-action-button--danger" : "journal-lifecycle-action-button--primary"}`}
        onClick={() => onHighImpactAction(row, action)}
      >
        {action.label}
      </button>
    );
  }

  if (isApprovalAction(action.action) && row.lifecycle.approval) {
    return (
      <Link
        className="journal-lifecycle-action journal-lifecycle-action--link"
        to={`/approval/requests/${row.lifecycle.approval.approvalRequestId}`}
      >
        {action.label}
      </Link>
    );
  }

  return <span className="journal-lifecycle-action">{action.label}</span>;
}

function Traceability({ lifecycle }: { lifecycle: JournalVoucherLifecycleDto }) {
  return (
    <div className="journal-lifecycle-trace" aria-label="رهگیری چرخه عمر سند">
      <article>
        <h4>تأیید</h4>
        {lifecycle.approval ? (
          <dl>
            <dt>درخواست</dt>
            <dd><Link to={`/approval/requests/${lifecycle.approval.approvalRequestId}`}>{lifecycle.approval.approvalRequestId}</Link></dd>
            <dt>نسخه محتوای ارسالی</dt><dd>{lifecycle.approval.submittedContentVersion.toLocaleString("fa-IR")}</dd>
            <dt>وضعیت</dt><dd>{approvalStatusLabel(lifecycle.approval.status)}</dd>
          </dl>
        ) : <p>شواهد تأیید جاری وجود ندارد.</p>}
      </article>
      <article>
        <h4>ثبت نهایی</h4>
        {lifecycle.posting ? (
          <dl>
            <dt>ثبت‌کننده</dt><dd>{lifecycle.posting.postedBy}</dd>
            <dt>زمان</dt><dd>{formatLifecycleTimestamp(lifecycle.posting.postedAt)}</dd>
            <dt>نسخه ثبت</dt><dd>{lifecycle.posting.postedVersion.toLocaleString("fa-IR")}</dd>
            <dt>مرجع</dt><dd>{lifecycle.posting.postingReference ?? "—"}</dd>
          </dl>
        ) : <p>سند هنوز ثبت نهایی نشده است.</p>}
      </article>
      <article>
        <h4>آخرین اصلاح کنترل‌شده</h4>
        {lifecycle.latestAmendment ? (
          <dl>
            <dt>کاربر</dt><dd>{lifecycle.latestAmendment.reopenedBy}</dd>
            <dt>زمان</dt><dd>{formatLifecycleTimestamp(lifecycle.latestAmendment.reopenedAt)}</dd>
            <dt>نسخه</dt><dd>{lifecycle.latestAmendment.previousVersion.toLocaleString("fa-IR")} ← {lifecycle.latestAmendment.reopenedVersion.toLocaleString("fa-IR")}</dd>
            <dt>دلیل</dt><dd>{lifecycle.latestAmendment.reason}</dd>
          </dl>
        ) : <p>اصلاح کنترل‌شده‌ای ثبت نشده است.</p>}
      </article>
      <article>
        <h4>برگشت و جایگزینی</h4>
        {lifecycle.reversal ? (
          <dl>
            <dt>سند اصلی</dt><dd dir="ltr">{lifecycle.reversal.originalVoucherId}</dd>
            <dt>سند برگشتی</dt><dd dir="ltr">{lifecycle.reversal.reversalVoucherId}</dd>
            <dt>سند جایگزین</dt><dd dir="ltr">{lifecycle.reversal.replacementVoucherId ?? "—"}</dd>
            <dt>کاربر</dt><dd>{lifecycle.reversal.reversedBy}</dd>
            <dt>زمان</dt><dd>{formatLifecycleTimestamp(lifecycle.reversal.reversedAt)}</dd>
            <dt>دلیل</dt><dd>{lifecycle.reversal.reason}</dd>
          </dl>
        ) : <p>برای این سند رابطه برگشت ثبت نشده است.</p>}
      </article>
    </div>
  );
}

function isApprovalAction(action: JournalVoucherLifecycleActionCapability): boolean {
  return action === "approve" || action === "reject" || action === "return_to_draft" || action === "cancel_approval";
}

function approvalStatusLabel(status: NonNullable<JournalVoucherLifecycleDto["approval"]>["status"]): string {
  switch (status) {
    case "pending": return "در انتظار تصمیم";
    case "approved": return "تأییدشده";
    case "closed": return "بسته‌شده";
  }
}

function formatLifecycleTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fa-IR-u-ca-persian");
}
