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

type ConfirmedActionKind = "submit" | "delete" | "post" | "reverse";

type PendingAction = {
  readonly kind: ConfirmedActionKind;
  readonly row: LifecycleRow;
  readonly action: JournalVoucherLifecycleActionView;
};

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

  const showFailure = useCallback((reason: unknown, operation: string) => {
    console.error(`[journal-lifecycle] ${operation} failed`, reason);
    setFailure(presentJournalVoucherLifecycleFailure(reason));
  }, []);

  useEffect(() => {
    void getDesktopDatabase()
      .then((database) => new SqliteCompanyRepository(database).findAll())
      .then((values) => {
        setCompanies(values);
        setCompanyId((current) => current || values[0]?.id || "");
      })
      .catch((reason: unknown) => showFailure(reason, "load companies"));
  }, [showFailure]);

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
      showFailure(reason, "load lifecycle overview");
    } finally {
      setBusy(false);
    }
  }, [companyId, journalLifecycle, journals, showFailure]);

  useEffect(() => {
    void load();
  }, [load]);

  const openConfirmation = useCallback((
    kind: ConfirmedActionKind,
    row: LifecycleRow,
    action: JournalVoucherLifecycleActionView,
  ) => {
    setFailure(null);
    setMessage("");
    setPostingReference("");
    setReversalDate(today());
    setReversalReason("");
    setPendingAction({ kind, row, action });
  }, []);

  const openDraftEditor = useCallback(async (row: LifecycleRow) => {
    setFailure(null);
    setMessage("در حال باز کردن سند برای ویرایش…");
    try {
      const listButton = Array.from(
        document.querySelectorAll<HTMLButtonElement>(".journal-list__item"),
      ).find((button) =>
        button.querySelector(".journal-list__number b")?.textContent?.trim() === row.voucher.number,
      );
      if (!listButton) {
        throw new Error(`Journal editor list item ${row.voucher.number} was not found.`);
      }

      listButton.click();
      const editButton = await waitForElement(() =>
        Array.from(document.querySelectorAll<HTMLButtonElement>(".journal-actions button"))
          .find((button) => button.textContent?.trim() === "ویرایش") ?? null,
      );
      editButton.click();
      const editor = await waitForElement(() =>
        document.querySelector<HTMLElement>(".journal-editor"),
      );
      editor.scrollIntoView({ behavior: "smooth", block: "start" });
      setMessage(`سند ${row.voucher.number} برای ویرایش باز شد.`);
    } catch (reason) {
      setMessage("");
      showFailure(reason, "open draft editor");
    }
  }, [showFailure]);

  const executePendingAction = useCallback(async () => {
    if (!pendingAction) return;
    if (!session?.user.id) {
      setFailure({
        kind: "business",
        title: "ورود به سامانه لازم است",
        message: "برای انجام عملیات چرخه عمر سند باید با کاربر معتبر وارد سامانه شوید.",
        technical: "journal.lifecycle.session-missing: authenticated user id is required",
      });
      return;
    }
    if (pendingAction.kind === "reverse" && !reversalReason.trim()) {
      setFailure({
        kind: "business",
        title: "دلیل برگشت الزامی است",
        message: "برای ایجاد سند برگشتی باید دلیل روشن و قابل رهگیری ثبت شود.",
        technical: "journal.reversal-reason-required",
      });
      return;
    }

    setBusy(true);
    setFailure(null);
    setMessage("");
    try {
      const { row } = pendingAction;
      const correlationId = crypto.randomUUID();
      const occurredAt = new Date().toISOString();

      switch (pendingAction.kind) {
        case "submit": {
          const result = await journalLifecycle.submit({
            context: {
              actorId: session.user.id,
              companyId: row.lifecycle.companyId,
              requestId: crypto.randomUUID(),
              correlationId,
              occurredAt,
            },
            voucherId: row.lifecycle.voucherId,
            expectedVersion: row.lifecycle.version,
            actor: {
              type: "user",
              id: session.user.id,
              displayName: session.user.displayName,
            },
          });
          setMessage(
            `سند ${row.voucher.number} برای تأیید ارسال شد. درخواست ${result.approvalRequest.id} ایجاد شد.`,
          );
          break;
        }
        case "delete": {
          const voucher = await journals.get({
            companyId: row.lifecycle.companyId,
            voucherId: row.lifecycle.voucherId,
          });
          await journals.delete({
            context: {
              actorId: session.user.id,
              companyId: voucher.companyId,
              branchId: voucher.branchId,
              correlationId,
            },
            voucherId: voucher.id,
            expectedVersion: voucher.version,
          });
          setMessage(`پیش‌نویس سند ${row.voucher.number} حذف شد.`);
          break;
        }
        case "post": {
          const result = await journalLifecycle.post({
            context: {
              actorId: session.user.id,
              companyId: row.lifecycle.companyId,
              requestId: crypto.randomUUID(),
              correlationId,
              occurredAt,
            },
            voucherId: row.lifecycle.voucherId,
            expectedVersion: row.lifecycle.version,
            ...(postingReference.trim()
              ? { postingReference: postingReference.trim() }
              : {}),
          });
          setMessage(
            `سند ${row.voucher.number} با موفقیت ثبت نهایی شد (نسخه ${result.voucher.version.toLocaleString("fa-IR")}).`,
          );
          break;
        }
        case "reverse": {
          const result = await journalLifecycle.reverse({
            context: {
              actorId: session.user.id,
              companyId: row.lifecycle.companyId,
              requestId: crypto.randomUUID(),
              correlationId,
              occurredAt,
            },
            voucherId: row.lifecycle.voucherId,
            expectedVersion: row.lifecycle.version,
            reversalDate,
            reason: reversalReason.trim(),
          });
          setMessage(
            result.replayed
              ? "درخواست برگشت قبلاً ثبت شده بود و نتیجه موجود بازیابی شد."
              : `سند برگشتی ${result.reversalVoucher.number} ایجاد و سند اصلی برگشت شد.`,
          );
          break;
        }
      }

      setPendingAction(null);
      await load();
    } catch (reason) {
      showFailure(reason, pendingAction.kind);
    } finally {
      setBusy(false);
    }
  }, [
    journalLifecycle,
    journals,
    load,
    pendingAction,
    postingReference,
    reversalDate,
    reversalReason,
    session,
    showFailure,
  ]);

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
          <h2 id="journal-lifecycle-title">وضعیت، تأیید، ثبت نهایی و رهگیری</h2>
          <p>
            عملیات چرخه عمر از Application اجرا می‌شوند و پس از هر عملیات، وضعیت و شواهد دوباره از پایگاه داده خوانده می‌شوند.
          </p>
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
              const view = presentJournalVoucherLifecycle(row.lifecycle, permissions);
              const isExpanded = expandedVoucherId === row.voucher.id;
              return (
                <LifecycleTableRows
                  key={row.voucher.id}
                  row={row}
                  view={view}
                  expanded={isExpanded}
                  onToggleTrace={() =>
                    setExpandedVoucherId(isExpanded ? null : row.voucher.id)
                  }
                  onEdit={openDraftEditor}
                  onConfirm={openConfirmation}
                />
              );
            })}
            {!busy && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="journal-lifecycle-overview__empty">
                  سندی برای نمایش وجود ندارد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pendingAction && (
        <ConfirmationDialog
          pendingAction={pendingAction}
          busy={busy}
          postingReference={postingReference}
          reversalDate={reversalDate}
          reversalReason={reversalReason}
          onPostingReferenceChange={setPostingReference}
          onReversalDateChange={setReversalDate}
          onReversalReasonChange={setReversalReason}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => void executePendingAction()}
        />
      )}
    </section>
  );
}

function LifecycleTableRows({
  row,
  view,
  expanded,
  onToggleTrace,
  onEdit,
  onConfirm,
}: {
  row: LifecycleRow;
  view: ReturnType<typeof presentJournalVoucherLifecycle>;
  expanded: boolean;
  onToggleTrace: () => void;
  onEdit: (row: LifecycleRow) => void;
  onConfirm: (
    kind: ConfirmedActionKind,
    row: LifecycleRow,
    action: JournalVoucherLifecycleActionView,
  ) => void;
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
                onEdit={onEdit}
                onConfirm={onConfirm}
              />
            ))}
            {view.actions.length === 0 && (
              <span className="journal-lifecycle-action--none">عملیات دیگری ندارد</span>
            )}
          </div>
        </td>
        <td>
          <button
            type="button"
            className="journal-lifecycle-trace-toggle"
            onClick={onToggleTrace}
          >
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
  onEdit,
  onConfirm,
}: {
  row: LifecycleRow;
  action: JournalVoucherLifecycleActionView;
  onEdit: (row: LifecycleRow) => void;
  onConfirm: (
    kind: ConfirmedActionKind,
    row: LifecycleRow,
    action: JournalVoucherLifecycleActionView,
  ) => void;
}) {
  if (action.action === "edit") {
    return (
      <button
        type="button"
        className="journal-lifecycle-action-button"
        onClick={() => void onEdit(row)}
      >
        {action.label}
      </button>
    );
  }

  if (action.action === "delete") {
    return (
      <button
        type="button"
        className="journal-lifecycle-action-button journal-lifecycle-action-button--danger"
        onClick={() => onConfirm("delete", row, action)}
      >
        {action.label}
      </button>
    );
  }

  if (action.action === "submit_for_approval") {
    return (
      <button
        type="button"
        className="journal-lifecycle-action-button journal-lifecycle-action-button--primary"
        onClick={() => onConfirm("submit", row, action)}
      >
        {action.label}
      </button>
    );
  }

  if (action.action === "post" || action.action === "reverse") {
    const confirmedAction = action.action;
    return (
      <button
        type="button"
        className={`journal-lifecycle-action-button ${
          confirmedAction === "reverse"
            ? "journal-lifecycle-action-button--danger"
            : "journal-lifecycle-action-button--primary"
        }`}
        onClick={() => onConfirm(confirmedAction, row, action)}
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

  return (
    <span
      className="journal-lifecycle-action journal-lifecycle-action--none"
      title="این عملیات در این نمای Desktop هنوز مسیر اجرایی مستقلی ندارد."
    >
      {action.label}
    </span>
  );
}

function ConfirmationDialog({
  pendingAction,
  busy,
  postingReference,
  reversalDate,
  reversalReason,
  onPostingReferenceChange,
  onReversalDateChange,
  onReversalReasonChange,
  onCancel,
  onConfirm,
}: {
  pendingAction: PendingAction;
  busy: boolean;
  postingReference: string;
  reversalDate: string;
  reversalReason: string;
  onPostingReferenceChange: (value: string) => void;
  onReversalDateChange: (value: string) => void;
  onReversalReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const destructive = pendingAction.kind === "delete" || pendingAction.kind === "reverse";
  const confirmationText = pendingAction.action.confirmation ?? confirmationFor(pendingAction.kind);

  return (
    <section
      className="journal-lifecycle-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !busy) onCancel();
      }}
    >
      <div
        className="journal-lifecycle-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-lifecycle-dialog-title"
      >
        <h3 id="journal-lifecycle-dialog-title">
          {dialogTitle(pendingAction.kind)} سند {pendingAction.row.voucher.number}
        </h3>
        <p>{confirmationText}</p>

        {pendingAction.kind === "post" && (
          <label>
            مرجع ثبت نهایی (اختیاری)
            <input
              value={postingReference}
              maxLength={100}
              onChange={(event) => onPostingReferenceChange(event.target.value)}
              autoFocus
            />
          </label>
        )}

        {pendingAction.kind === "reverse" && (
          <>
            <label>
              تاریخ برگشت
              <PersianDatePicker
                value={reversalDate}
                onChange={onReversalDateChange}
                ariaLabel="تاریخ برگشت سند"
              />
            </label>
            <label>
              دلیل برگشت
              <textarea
                value={reversalReason}
                maxLength={500}
                rows={3}
                onChange={(event) => onReversalReasonChange(event.target.value)}
                autoFocus
              />
            </label>
          </>
        )}

        {pendingAction.kind === "delete" && (
          <p role="alert">
            حذف پیش‌نویس قابل بازگردانی نیست. فقط در صورت اطمینان ادامه دهید.
          </p>
        )}

        {pendingAction.kind === "submit" && (
          <p>
            پس از ارسال، سند قفل می‌شود و برای ادامه باید در گردش تأیید درباره آن تصمیم‌گیری شود.
          </p>
        )}

        <div className="journal-lifecycle-dialog__actions">
          <button type="button" disabled={busy} onClick={onCancel}>
            انصراف
          </button>
          <button
            type="button"
            className={`journal-lifecycle-action-button ${
              destructive
                ? "journal-lifecycle-action-button--danger"
                : "journal-lifecycle-action-button--primary"
            }`}
            disabled={
              busy ||
              (pendingAction.kind === "reverse" && !reversalReason.trim())
            }
            onClick={onConfirm}
            autoFocus={pendingAction.kind !== "post" && pendingAction.kind !== "reverse"}
          >
            {busy ? "در حال انجام…" : confirmButtonLabel(pendingAction.kind)}
          </button>
        </div>
      </div>
    </section>
  );
}

function Traceability({ lifecycle }: { lifecycle: JournalVoucherLifecycleDto }) {
  return (
    <div className="journal-lifecycle-trace" aria-label="رهگیری چرخه عمر سند">
      <article>
        <h4>تأیید</h4>
        {lifecycle.approval ? (
          <dl>
            <dt>درخواست</dt>
            <dd>
              <Link to={`/approval/requests/${lifecycle.approval.approvalRequestId}`}>
                {lifecycle.approval.approvalRequestId}
              </Link>
            </dd>
            <dt>نسخه محتوای ارسالی</dt>
            <dd>{lifecycle.approval.submittedContentVersion.toLocaleString("fa-IR")}</dd>
            <dt>وضعیت</dt>
            <dd>{approvalStatusLabel(lifecycle.approval.status)}</dd>
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
            <dt>نسخه</dt>
            <dd>
              {lifecycle.latestAmendment.previousVersion.toLocaleString("fa-IR")} ← {lifecycle.latestAmendment.reopenedVersion.toLocaleString("fa-IR")}
            </dd>
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
  return action === "approve" ||
    action === "reject" ||
    action === "return_to_draft" ||
    action === "cancel_approval";
}

function approvalStatusLabel(
  status: NonNullable<JournalVoucherLifecycleDto["approval"]>["status"],
): string {
  switch (status) {
    case "pending": return "در انتظار تصمیم";
    case "approved": return "تأییدشده";
    case "closed": return "بسته‌شده";
  }
}

function formatLifecycleTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("fa-IR-u-ca-persian");
}

function dialogTitle(kind: ConfirmedActionKind): string {
  switch (kind) {
    case "submit": return "ارسال برای تأیید";
    case "delete": return "حذف پیش‌نویس";
    case "post": return "ثبت نهایی";
    case "reverse": return "برگشت";
  }
}

function confirmButtonLabel(kind: ConfirmedActionKind): string {
  switch (kind) {
    case "submit": return "ارسال برای تأیید";
    case "delete": return "حذف پیش‌نویس";
    case "post": return "ثبت نهایی";
    case "reverse": return "ایجاد سند برگشتی";
  }
}

function confirmationFor(kind: ConfirmedActionKind): string {
  switch (kind) {
    case "submit": return "این سند برای گردش تأیید ارسال شود؟";
    case "delete": return "این پیش‌نویس به‌طور کامل حذف شود؟";
    case "post": return "ثبت نهایی سند انجام شود؟";
    case "reverse": return "برای این سند، سند برگشتی مستقل ایجاد شود؟";
  }
}

async function waitForElement<T extends Element>(
  resolve: () => T | null,
  timeoutMs = 2500,
): Promise<T> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const element = resolve();
    if (element) return element;
    await new Promise((resolveDelay) => window.setTimeout(resolveDelay, 50));
  }
  throw new Error("Timed out while waiting for the journal editor UI to become available.");
}
