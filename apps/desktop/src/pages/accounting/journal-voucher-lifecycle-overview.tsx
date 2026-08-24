import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getJournalVoucherLifecycle,
  type JournalVoucherLifecycleDto,
  type JournalVoucherListItemDto,
} from "@argin/accounting/journal";
import { SqliteJournalVoucherLifecycleReader } from "@argin/accounting-tauri";
import type { Company } from "@argin/company";
import { SqliteCompanyRepository } from "@argin/company-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useAuthSession } from "../../app/providers/auth-session-provider";
import { useAccountingServices } from "../../composition/accounting/accounting-provider";
import {
  formatJournalVoucherDate,
} from "../../features/accounting/journal-voucher-presenter";
import {
  presentJournalVoucherLifecycle,
} from "../../features/accounting/journal-voucher-lifecycle-presenter";

import "./journal-voucher-lifecycle-overview.css";

interface LifecycleRow {
  readonly voucher: JournalVoucherListItemDto;
  readonly lifecycle: JournalVoucherLifecycleDto;
}

export function JournalVoucherLifecycleOverview() {
  const { journals } = useAccountingServices();
  const { session } = useAuthSession();
  const [companies, setCompanies] = useState<readonly Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [rows, setRows] = useState<readonly LifecycleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  }, []);

  const load = useCallback(async () => {
    if (!companyId) {
      setRows([]);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const database = await getDesktopDatabase();
      const reader = new SqliteJournalVoucherLifecycleReader(database);
      const page = await journals.search({ companyId, page: 1, pageSize: 30 });
      const values = await Promise.all(
        page.items.map(async (voucher) => ({
          voucher,
          lifecycle: await getJournalVoucherLifecycle(
            { companyId, voucherId: voucher.id },
            reader,
          ),
        })),
      );
      setRows(Object.freeze(values));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }, [companyId, journals]);

  useEffect(() => {
    void load();
  }, [load]);

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
          <h2 id="journal-lifecycle-title">وضعیت و عملیات مجاز</h2>
          <p>
            وضعیت از Application خوانده می‌شود؛ نمایش دکمه‌ها جایگزین کنترل مجوز در سرور برنامه نیست.
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

      {error && <p className="journal-lifecycle-overview__error" role="alert">{error}</p>}

      <div className="journal-lifecycle-overview__table-wrap">
        <table className="journal-lifecycle-overview__table">
          <thead>
            <tr>
              <th>سند</th>
              <th>تاریخ</th>
              <th>وضعیت</th>
              <th>قفل</th>
              <th>نسخه</th>
              <th>عملیات بعدی مجاز</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ voucher, lifecycle }) => {
              const view = presentJournalVoucherLifecycle(lifecycle, permissions);
              return (
                <tr key={voucher.id}>
                  <td><b dir="ltr">{voucher.number}</b></td>
                  <td>{formatJournalVoucherDate(voucher.voucherDate)}</td>
                  <td>
                    <span className={`journal-lifecycle-status journal-lifecycle-status--${view.tone}`}>
                      {view.statusLabel}
                    </span>
                    <small>{view.statusDescription}</small>
                  </td>
                  <td>{view.locked ? "قفل" : "قابل ویرایش"}</td>
                  <td>{view.versionLabel}</td>
                  <td>
                    <div className="journal-lifecycle-actions" aria-label={`عملیات سند ${voucher.number}`}>
                      {view.actions.map((action) => (
                        <span
                          className={action.consequential ? "journal-lifecycle-action journal-lifecycle-action--important" : "journal-lifecycle-action"}
                          key={action.action}
                          title={action.confirmation ?? undefined}
                        >
                          {action.label}
                        </span>
                      ))}
                      {view.actions.length === 0 && <span className="journal-lifecycle-action--none">عملیات دیگری ندارد</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!busy && rows.length === 0 && (
              <tr><td colSpan={6} className="journal-lifecycle-overview__empty">سندی برای نمایش وجود ندارد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
