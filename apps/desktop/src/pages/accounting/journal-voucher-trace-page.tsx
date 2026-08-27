import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { journalVoucherPermissions, type JournalVoucherDto } from "@argin/accounting/journal";

import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Feedback } from "../../components/feedback";
import { Page } from "../../components/layout";
import { useAccountingServices } from "../../composition/accounting/accounting-provider";
import type { JournalAccountOption } from "../../composition/accounting/create-journal-voucher-services";
import {
  formatJournalRials,
  formatJournalVoucherDate,
  journalVoucherSourceLabel,
} from "../../features/accounting/journal-voucher-presenter";

import "./accounting-workspace.css";
import "./journal-voucher-trace-page.css";

export function JournalVoucherTracePage() {
  const navigate = useNavigate();
  const { voucherId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get("companyId")?.trim() ?? "";
  const journalLineId = searchParams.get("journalLineId")?.trim() ?? "";
  const { journals } = useAccountingServices();
  const { session } = useAuthSession();
  const permissions = useMemo(
    () => new Set(session?.user.permissions ?? []),
    [session],
  );
  const canView = permissions.has("system.full-access") ||
    permissions.has(journalVoucherPermissions.view);
  const [voucher, setVoucher] = useState<JournalVoucherDto | null>(null);
  const [accounts, setAccounts] = useState<readonly JournalAccountOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canView || !companyId || !voucherId) return;
    let cancelled = false;
    setBusy(true);
    setError("");
    void Promise.all([
      journals.get({ companyId, voucherId }),
      journals.listPostingAccounts(companyId),
    ])
      .then(([loadedVoucher, loadedAccounts]) => {
        if (cancelled) return;
        setVoucher(loadedVoucher);
        setAccounts(loadedAccounts);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "خواندن سند منبع ناموفق بود.");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
  }, [canView, companyId, journals, voucherId]);

  if (!canView) {
    return (
      <Page className="accounting-workspace journal-trace-page" lang="fa" dir="rtl">
        <Feedback tone="error">شما مجوز مشاهده سند حسابداری منبع را ندارید.</Feedback>
      </Page>
    );
  }

  const accountNames = new Map(
    accounts.map((account) => [account.id, `${account.code} — ${account.name}`]),
  );

  return (
    <Page className="accounting-workspace journal-trace-page" lang="fa" dir="rtl">
      <header className="accounting-workspace__header journal-trace-page__header">
        <div>
          <p className="accounting-workspace__eyebrow">گزارش حسابداری / رهگیری سند منبع</p>
          <h1>سند حسابداری منبع</h1>
          <p>رهگیری قطعی از ردیف گزارش تا Voucher ID و Journal Line ID ذخیره‌شده</p>
        </div>
        <button type="button" onClick={() => navigate(-1)}>بازگشت به گزارش</button>
      </header>

      {busy && <div className="journal-trace-page__state" role="status">در حال خواندن سند…</div>}
      {error && <Feedback tone="error">{error}</Feedback>}

      {!busy && !error && voucher && (
        <section className="journal-trace-card">
          <div className="journal-trace-card__heading">
            <div>
              <span>شماره سند</span>
              <strong>{voucher.number}</strong>
            </div>
            <div>
              <span>تاریخ</span>
              <strong>{formatJournalVoucherDate(voucher.voucherDate)}</strong>
            </div>
            <div>
              <span>منبع</span>
              <strong>{journalVoucherSourceLabel(voucher.sourceType)}</strong>
            </div>
            <div>
              <span>Voucher ID</span>
              <code dir="ltr">{voucher.id}</code>
            </div>
          </div>

          <p className="journal-trace-card__description">
            {voucher.description || voucher.reference || "بدون شرح"}
          </p>

          <div className="journal-trace-table-wrap">
            <table className="ui-table journal-trace-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>حساب</th>
                  <th>شرح</th>
                  <th>بدهکار</th>
                  <th>بستانکار</th>
                  <th>Journal Line ID</th>
                </tr>
              </thead>
              <tbody>
                {voucher.lines.map((line) => {
                  const traced = journalLineId !== "" && line.id === journalLineId;
                  return (
                    <tr
                      key={line.id}
                      className={traced ? "journal-trace-table__row--active" : undefined}
                      aria-current={traced ? "true" : undefined}
                    >
                      <td>{line.order.toLocaleString("fa-IR")}</td>
                      <td>{accountNames.get(line.accountId) ?? line.accountId}</td>
                      <td>{line.description ?? "—"}</td>
                      <td className="journal-trace-number">{formatJournalRials(line.debit.amount)}</td>
                      <td className="journal-trace-number">{formatJournalRials(line.credit.amount)}</td>
                      <td><code dir="ltr">{line.id}</code></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3}>جمع سند</th>
                  <th className="journal-trace-number">{formatJournalRials(voucher.totalDebit.amount)}</th>
                  <th className="journal-trace-number">{formatJournalRials(voucher.totalCredit.amount)}</th>
                  <th />
                </tr>
              </tfoot>
            </table>
          </div>

          {journalLineId && !voucher.lines.some((line) => line.id === journalLineId) && (
            <Feedback tone="error">ردیف رهگیری‌شده در این سند پیدا نشد.</Feedback>
          )}
        </section>
      )}
    </Page>
  );
}
