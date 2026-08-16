import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AccountingDimensionAssignment,
  AccountingDimensionSelectorModel,
} from "@argin/accounting";
import {
  journalVoucherPermissions,
  type JournalVoucherDto,
  type JournalVoucherListItemDto,
} from "@argin/accounting/journal";
import type { Company } from "@argin/company";
import { SqliteCompanyRepository } from "@argin/company-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useAuthSession } from "../../app/providers/auth-session-provider";
import { useAccountingServices } from "../../composition/accounting/accounting-provider";
import type {
  JournalAccountOption,
  JournalBranchOption,
} from "../../composition/accounting/create-journal-voucher-services";
import {
  formatJournalRials,
  formatJournalVoucherDate,
  journalVoucherSourceLabel,
  journalVoucherStatusLabel,
  parseRialInput,
  presentJournalVoucherError,
} from "../../features/accounting/journal-voucher-presenter";

import "./journal-vouchers-page.css";

interface VoucherLineDraft {
  readonly key: string;
  readonly id: string | null;
  readonly accountId: string;
  readonly description: string;
  readonly debit: string;
  readonly credit: string;
  readonly assignments: readonly AccountingDimensionAssignment[];
}

interface VoucherDraft {
  readonly voucherId: string | null;
  readonly version: number | null;
  readonly branchId: string;
  readonly voucherDate: string;
  readonly reference: string;
  readonly description: string;
  readonly lines: readonly VoucherLineDraft[];
}

const today = new Date().toISOString().slice(0, 10);

function emptyLine(): VoucherLineDraft {
  return {
    key: crypto.randomUUID(),
    id: null,
    accountId: "",
    description: "",
    debit: "",
    credit: "",
    assignments: [],
  };
}

function emptyDraft(): VoucherDraft {
  return {
    voucherId: null,
    version: null,
    branchId: "",
    voucherDate: today,
    reference: "",
    description: "",
    lines: [emptyLine(), emptyLine()],
  };
}

export function JournalVouchersPage() {
  const { journals } = useAccountingServices();
  const { session } = useAuthSession();
  const [companies, setCompanies] = useState<readonly Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [branches, setBranches] = useState<readonly JournalBranchOption[]>([]);
  const [accounts, setAccounts] = useState<readonly JournalAccountOption[]>([]);
  const [items, setItems] = useState<readonly JournalVoucherListItemDto[]>([]);
  const [selected, setSelected] = useState<JournalVoucherDto | null>(null);
  const [draft, setDraft] = useState<VoucherDraft>(emptyDraft);
  const [dimensions, setDimensions] = useState<Readonly<Record<string, AccountingDimensionSelectorModel>>>({});
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [technicalError, setTechnicalError] = useState<string | null>(null);

  const permissionSet = useMemo(
    () => new Set(session?.user.permissions ?? []),
    [session],
  );
  const can = useCallback(
    (permission: string) =>
      permissionSet.has("system.full-access") || permissionSet.has(permission),
    [permissionSet],
  );

  const clearError = useCallback(() => {
    setError("");
    setTechnicalError(null);
  }, []);

  const showError = useCallback((reason: unknown) => {
    const presented = presentJournalVoucherError(reason);
    setError(presented.message);
    setTechnicalError(presented.technical);
  }, []);

  useEffect(() => {
    void getDesktopDatabase()
      .then((database) => new SqliteCompanyRepository(database).findAll())
      .then((values) => {
        setCompanies(values);
        setCompanyId((current) => current || values[0]?.id || "");
      })
      .catch(showError);
  }, [showError]);

  const loadLookupData = useCallback(async () => {
    if (!companyId) {
      setAccounts([]);
      setBranches([]);
      return;
    }
    const [loadedAccounts, loadedBranches] = await Promise.all([
      journals.listPostingAccounts(companyId),
      journals.listBranches(companyId),
    ]);
    setAccounts(loadedAccounts);
    setBranches(loadedBranches);
  }, [companyId, journals]);

  const reloadList = useCallback(async () => {
    if (!companyId) {
      setItems([]);
      return;
    }
    setBusy(true);
    clearError();
    try {
      const page = await journals.search({
        companyId,
        ...(search.trim() ? { text: search.trim() } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        page: 1,
        pageSize: 100,
      });
      setItems(page.items);
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }, [clearError, companyId, dateFrom, dateTo, journals, search, showError]);

  useEffect(() => {
    void loadLookupData().catch(showError);
    void reloadList();
  }, [loadLookupData, reloadList, showError]);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    let invalid = false;
    for (const line of draft.lines) {
      const lineDebit = parseRialInput(line.debit);
      const lineCredit = parseRialInput(line.credit);
      if (Number.isNaN(lineDebit) || Number.isNaN(lineCredit)) invalid = true;
      else {
        debit += lineDebit;
        credit += lineCredit;
      }
    }
    return { debit, credit, invalid, balanced: !invalid && debit === credit && debit > 0 };
  }, [draft.lines]);

  const updateLine = useCallback(
    (key: string, changes: Partial<VoucherLineDraft>) => {
      setDraft((current) => ({
        ...current,
        lines: current.lines.map((line) =>
          line.key === key ? { ...line, ...changes } : line
        ),
      }));
    },
    [],
  );

  const loadDimensionsForLine = useCallback(async (
    line: VoucherLineDraft,
    voucherDate = draft.voucherDate,
  ) => {
    if (!companyId || !line.accountId || !voucherDate) {
      setDimensions((current) => {
        const next = { ...current };
        delete next[line.key];
        return next;
      });
      return;
    }
    const model = await journals.loadDimensionSelector({
      companyId,
      accountId: line.accountId,
      documentDate: voucherDate,
      assignments: line.assignments,
    });
    setDimensions((current) => ({ ...current, [line.key]: model }));
  }, [companyId, draft.voucherDate, journals]);

  const chooseAccount = useCallback(async (key: string, accountId: string) => {
    const line = draft.lines.find((value) => value.key === key);
    if (!line) return;
    const updated = { ...line, accountId, assignments: [] };
    updateLine(key, { accountId, assignments: [] });
    try {
      await loadDimensionsForLine(updated);
    } catch (reason) {
      showError(reason);
    }
  }, [draft.lines, loadDimensionsForLine, showError, updateLine]);

  const chooseDimension = useCallback((
    line: VoucherLineDraft,
    dimensionTypeId: string,
    memberIds: readonly string[],
  ) => {
    const assignments = line.assignments.filter(
      (assignment) => assignment.dimensionTypeId !== dimensionTypeId,
    );
    if (memberIds.length > 0) {
      assignments.push({ dimensionTypeId, memberIds: Object.freeze([...memberIds]) });
    }
    updateLine(line.key, { assignments: Object.freeze(assignments) });
  }, [updateLine]);

  const startNew = useCallback(() => {
    setSelected(null);
    setDraft(emptyDraft());
    setDimensions({});
    setMessage("");
    clearError();
  }, [clearError]);

  const openVoucher = useCallback(async (id: string) => {
    if (!companyId) return;
    setBusy(true);
    clearError();
    try {
      const detail = await journals.get({ companyId, voucherId: id });
      setSelected(detail);
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }, [clearError, companyId, journals, showError]);

  const startEdit = useCallback(async () => {
    if (!selected) return;
    const lines: VoucherLineDraft[] = selected.lines.map((line) => ({
      key: line.id,
      id: line.id,
      accountId: line.accountId,
      description: line.description ?? "",
      debit: line.debit.amount === 0 ? "" : String(line.debit.amount),
      credit: line.credit.amount === 0 ? "" : String(line.credit.amount),
      assignments: line.dimensionAssignments,
    }));
    const nextDraft: VoucherDraft = {
      voucherId: selected.id,
      version: selected.version,
      branchId: selected.branchId ?? "",
      voucherDate: selected.voucherDate,
      reference: selected.reference ?? "",
      description: selected.description ?? "",
      lines,
    };
    setDraft(nextDraft);
    setMessage("");
    clearError();
    const loaded: Record<string, AccountingDimensionSelectorModel> = {};
    try {
      for (const line of lines) {
        if (!line.accountId) continue;
        loaded[line.key] = await journals.loadDimensionSelector({
          companyId: selected.companyId,
          accountId: line.accountId,
          documentDate: selected.voucherDate,
          assignments: line.assignments,
        });
      }
      setDimensions(loaded);
      setSelected(null);
    } catch (reason) {
      showError(reason);
    }
  }, [clearError, journals, selected, showError]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!companyId) return;
    setBusy(true);
    setMessage("");
    clearError();
    try {
      const lines = draft.lines.map((line, index) => {
        const debit = parseRialInput(line.debit);
        const credit = parseRialInput(line.credit);
        if (Number.isNaN(debit) || Number.isNaN(credit)) {
          throw new Error(`Invalid Rial amount in journal line ${index + 1}.`);
        }
        return {
          ...(line.id ? { id: line.id } : {}),
          order: index + 1,
          accountId: line.accountId,
          description: line.description || null,
          debit,
          credit,
          dimensionAssignments: line.assignments,
        };
      });
      const context = {
        actorId: session?.user.id ?? "desktop-local-user",
        companyId,
        branchId: draft.branchId || null,
        correlationId: crypto.randomUUID(),
      };

      if (draft.voucherId === null) {
        const result = await journals.create({
          context: { ...context, requestId: crypto.randomUUID() },
          voucherDate: draft.voucherDate,
          reference: draft.reference || null,
          description: draft.description || null,
          lines,
        });
        setMessage(`سند شماره ${result.voucher.number} با موفقیت ذخیره شد.`);
        setDraft(emptyDraft());
        setDimensions({});
        await reloadList();
        await openVoucher(result.voucher.id);
      } else {
        const result = await journals.update({
          context,
          voucherId: draft.voucherId,
          expectedVersion: draft.version ?? 1,
          voucherDate: draft.voucherDate,
          reference: draft.reference || null,
          description: draft.description || null,
          lines,
        });
        setMessage("تغییرات سند پیش‌نویس ذخیره شد.");
        setDraft(emptyDraft());
        setDimensions({});
        await reloadList();
        await openVoucher(result.voucher.id);
      }
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  const removeSelected = useCallback(async () => {
    if (!selected || !window.confirm(`سند شماره ${selected.number} حذف شود؟`)) return;
    setBusy(true);
    clearError();
    try {
      await journals.delete({
        context: {
          actorId: session?.user.id ?? "desktop-local-user",
          companyId: selected.companyId,
          branchId: selected.branchId,
          correlationId: crypto.randomUUID(),
        },
        voucherId: selected.id,
        expectedVersion: selected.version,
      });
      setSelected(null);
      setMessage("سند پیش‌نویس حذف شد.");
      await reloadList();
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }, [clearError, journals, reloadList, selected, session, showError]);

  const changeVoucherDate = useCallback(async (value: string) => {
    setDraft((current) => ({ ...current, voucherDate: value }));
    try {
      for (const line of draft.lines) {
        if (line.accountId) await loadDimensionsForLine(line, value);
      }
    } catch (reason) {
      showError(reason);
    }
  }, [draft.lines, loadDimensionsForLine, showError]);

  return (
    <section className="journal-page" lang="fa" dir="rtl">
      <header className="journal-page__header">
        <div>
          <p className="journal-page__eyebrow">حسابداری / اسناد</p>
          <h1>اسناد حسابداری</h1>
          <p>ثبت و نگهداری سند دوبل پیش‌نویس با حساب و ابعاد حسابداری</p>
        </div>
        <button
          className="journal-button journal-button--primary"
          type="button"
          disabled={!can(journalVoucherPermissions.create)}
          onClick={startNew}
        >
          سند جدید
        </button>
      </header>

      <div className="journal-toolbar">
        <label>
          شرکت
          <select value={companyId} onChange={(event) => {
            setCompanyId(event.target.value);
            setSelected(null);
            startNew();
          }}>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.legalName}</option>
            ))}
          </select>
        </label>
        <label className="journal-toolbar__search">
          جست‌وجو
          <input
            value={search}
            placeholder="شماره، مرجع یا شرح سند"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          از تاریخ
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label>
          تا تاریخ
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <button type="button" disabled={busy} onClick={() => void reloadList()}>
          جست‌وجو
        </button>
      </div>

      {companies.length === 0 && !busy && (
        <p className="journal-notice">ابتدا یک شرکت و سال مالی ایجاد کنید.</p>
      )}
      {error && <p className="journal-alert journal-alert--error" role="alert">{error}</p>}
      {technicalError && (
        <details className="journal-technical-error">
          <summary>جزئیات فنی</summary>
          <code dir="ltr">{technicalError}</code>
        </details>
      )}
      {message && <p className="journal-alert journal-alert--success" role="status">{message}</p>}

      <div className="journal-layout">
        <aside className="journal-list-card">
          <div className="journal-card-title">
            <h2>فهرست اسناد</h2>
            <span>{items.length.toLocaleString("fa-IR")} سند</span>
          </div>
          <div className="journal-list">
            {items.map((item) => (
              <button
                type="button"
                className="journal-list__item"
                key={item.id}
                onClick={() => void openVoucher(item.id)}
              >
                <span><b dir="ltr">{item.number}</b> · {formatJournalVoucherDate(item.voucherDate)}</span>
                <span>{item.description || item.reference || "بدون شرح"}</span>
                <strong>{formatJournalRials(item.totalDebit.amount)}</strong>
              </button>
            ))}
            {items.length === 0 && <p className="journal-empty">سندی برای نمایش وجود ندارد.</p>}
          </div>
        </aside>

        <div className="journal-workspace">
          {selected ? (
            <section className="journal-detail-card">
              <div className="journal-card-title">
                <div>
                  <p className="journal-page__eyebrow">جزئیات سند</p>
                  <h2>سند شماره <span dir="ltr">{selected.number}</span></h2>
                </div>
                <div className="journal-actions">
                  <button
                    type="button"
                    disabled={!can(journalVoucherPermissions.updateDraft)}
                    onClick={() => void startEdit()}
                  >ویرایش</button>
                  <button
                    type="button"
                    className="journal-button--danger"
                    disabled={!can(journalVoucherPermissions.deleteDraft)}
                    onClick={() => void removeSelected()}
                  >حذف</button>
                  <button type="button" onClick={() => setSelected(null)}>بستن</button>
                </div>
              </div>
              <dl className="journal-detail-grid">
                <div><dt>تاریخ شمسی</dt><dd>{formatJournalVoucherDate(selected.voucherDate)}</dd></div>
                <div><dt>تاریخ داخلی</dt><dd dir="ltr">{selected.voucherDate}</dd></div>
                <div><dt>وضعیت</dt><dd>{journalVoucherStatusLabel()}</dd></div>
                <div><dt>منبع</dt><dd>{journalVoucherSourceLabel(selected.sourceType)}</dd></div>
                <div><dt>مرجع</dt><dd>{selected.reference || "—"}</dd></div>
                <div><dt>نسخه</dt><dd>{selected.version.toLocaleString("fa-IR")}</dd></div>
              </dl>
              <p className="journal-detail-description">{selected.description || "بدون شرح سند"}</p>
              <div className="journal-table-wrap">
                <table className="journal-table">
                  <thead><tr><th>ردیف</th><th>حساب</th><th>شرح</th><th>ابعاد</th><th>بدهکار</th><th>بستانکار</th></tr></thead>
                  <tbody>
                    {selected.lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.order.toLocaleString("fa-IR")}</td>
                        <td>{accounts.find((account) => account.id === line.accountId)?.name ?? line.accountId}</td>
                        <td>{line.description || "—"}</td>
                        <td>{line.dimensionAssignments.length === 0 ? "—" : line.dimensionAssignments.map((assignment) => assignment.memberIds.join("، ")).join(" / ")}</td>
                        <td>{line.debit.amount ? formatJournalRials(line.debit.amount) : "—"}</td>
                        <td>{line.credit.amount ? formatJournalRials(line.credit.amount) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td colSpan={4}>جمع</td><td>{formatJournalRials(selected.totalDebit.amount)}</td><td>{formatJournalRials(selected.totalCredit.amount)}</td></tr></tfoot>
                </table>
              </div>
            </section>
          ) : (
            <form className="journal-editor" onSubmit={(event) => void submit(event)}>
              <div className="journal-card-title">
                <div>
                  <p className="journal-page__eyebrow">{draft.voucherId ? "ویرایش پیش‌نویس" : "سند جدید"}</p>
                  <h2>{draft.voucherId ? "ویرایش سند حسابداری" : "ثبت سند حسابداری"}</h2>
                </div>
                {draft.voucherId && <button type="button" onClick={startNew}>انصراف از ویرایش</button>}
              </div>

              <div className="journal-form-grid">
                <label>
                  شعبه
                  <select value={draft.branchId} onChange={(event) => setDraft((current) => ({ ...current, branchId: event.target.value }))}>
                    <option value="">بدون شعبه</option>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>)}
                  </select>
                </label>
                <label>
                  تاریخ سند
                  <input required type="date" value={draft.voucherDate} onChange={(event) => void changeVoucherDate(event.target.value)} />
                  <small>شمسی: {formatJournalVoucherDate(draft.voucherDate)}</small>
                </label>
                <label>
                  شماره مرجع
                  <input value={draft.reference} maxLength={100} onChange={(event) => setDraft((current) => ({ ...current, reference: event.target.value }))} />
                </label>
                <label className="journal-form-grid__wide">
                  شرح سند
                  <input value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
                </label>
              </div>

              <div className="journal-lines-title">
                <h3>آرتیکل‌های سند</h3>
                <button type="button" onClick={() => setDraft((current) => ({ ...current, lines: [...current.lines, emptyLine()] }))}>افزودن سطر</button>
              </div>

              <div className="journal-line-editor">
                {draft.lines.map((line, index) => {
                  const selector = dimensions[line.key];
                  return (
                    <article className="journal-line" key={line.key}>
                      <div className="journal-line__number">{(index + 1).toLocaleString("fa-IR")}</div>
                      <label className="journal-line__account">
                        حساب
                        <select required value={line.accountId} onChange={(event) => void chooseAccount(line.key, event.target.value)}>
                          <option value="">انتخاب حساب معین</option>
                          {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}
                        </select>
                      </label>
                      <label>
                        بدهکار (ریال)
                        <input inputMode="numeric" dir="ltr" value={line.debit} onChange={(event) => updateLine(line.key, { debit: event.target.value, credit: event.target.value.trim() && parseRialInput(event.target.value) > 0 ? "" : line.credit })} />
                      </label>
                      <label>
                        بستانکار (ریال)
                        <input inputMode="numeric" dir="ltr" value={line.credit} onChange={(event) => updateLine(line.key, { credit: event.target.value, debit: event.target.value.trim() && parseRialInput(event.target.value) > 0 ? "" : line.debit })} />
                      </label>
                      <label className="journal-line__description">
                        شرح سطر
                        <input value={line.description} onChange={(event) => updateLine(line.key, { description: event.target.value })} />
                      </label>
                      {selector?.fields.map((field) => (
                        <label key={field.dimensionTypeId} className="journal-line__dimension">
                          {field.label}{field.required ? " *" : ""}
                          <select
                            multiple={field.multiple}
                            disabled={field.disabled}
                            value={line.assignments.find((value) => value.dimensionTypeId === field.dimensionTypeId)?.memberIds ?? []}
                            onChange={(event) => {
                              const memberIds = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                              chooseDimension(line, field.dimensionTypeId, memberIds);
                            }}
                          >
                            {!field.multiple && <option value="">انتخاب نشده</option>}
                            {field.options.map((option) => <option key={option.id} value={option.id}>{option.code} — {option.name}</option>)}
                          </select>
                          {field.disabled && <small>تخصیص این بُعد برای حساب ممنوع است.</small>}
                        </label>
                      ))}
                      <button
                        className="journal-line__remove"
                        type="button"
                        disabled={draft.lines.length <= 2}
                        onClick={() => {
                          setDraft((current) => ({ ...current, lines: current.lines.filter((value) => value.key !== line.key) }));
                          setDimensions((current) => {
                            const next = { ...current };
                            delete next[line.key];
                            return next;
                          });
                        }}
                      >حذف سطر</button>
                    </article>
                  );
                })}
              </div>

              <div className={`journal-totals ${totals.balanced ? "journal-totals--balanced" : "journal-totals--unbalanced"}`}>
                <span>جمع بدهکار: <b>{totals.invalid ? "نامعتبر" : formatJournalRials(totals.debit)}</b></span>
                <span>جمع بستانکار: <b>{totals.invalid ? "نامعتبر" : formatJournalRials(totals.credit)}</b></span>
                <strong>{totals.balanced ? "سند تراز است" : "سند تراز نیست"}</strong>
              </div>

              <div className="journal-editor__actions">
                <button
                  className="journal-button journal-button--primary"
                  type="submit"
                  disabled={busy || !totals.balanced || !can(draft.voucherId ? journalVoucherPermissions.updateDraft : journalVoucherPermissions.create)}
                >
                  {busy ? "در حال ذخیره…" : draft.voucherId ? "ذخیره تغییرات" : "ثبت سند پیش‌نویس"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
