import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AccountingDimensionAssignment,
  AccountingDimensionSelectorField,
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
import { PersianDatePicker } from "../../components/forms";
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

interface DimensionColumn {
  readonly dimensionTypeId: string;
  readonly label: string;
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

  const permissions = useMemo(
    () => new Set(session?.user.permissions ?? []),
    [session],
  );
  const can = useCallback(
    (permission: string) =>
      permissions.has("system.full-access") || permissions.has(permission),
    [permissions],
  );

  const currentCompany = useMemo(
    () => companies.find((company) => company.id === companyId) ?? null,
    [companies, companyId],
  );
  const currentBranch = useMemo(
    () => branches.find((branch) => branch.id === draft.branchId) ?? null,
    [branches, draft.branchId],
  );

  const dimensionColumns = useMemo<readonly DimensionColumn[]>(() => {
    const map = new Map<string, string>();
    for (const model of Object.values(dimensions)) {
      for (const field of model.fields) {
        if (field.disabled) continue;
        if (!map.has(field.dimensionTypeId)) {
          map.set(field.dimensionTypeId, field.label);
        }
      }
    }
    return Object.freeze(
      [...map.entries()].map(([dimensionTypeId, label]) =>
        Object.freeze({ dimensionTypeId, label }),
      ),
    );
  }, [dimensions]);

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
    return {
      debit,
      credit,
      balance: debit - credit,
      invalid,
      balanced: !invalid && debit === credit && debit > 0,
    };
  }, [draft.lines]);

  const updateLine = useCallback((key: string, changes: Partial<VoucherLineDraft>) => {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.key === key ? { ...line, ...changes } : line
      ),
    }));
  }, []);

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
      assignments.push({
        dimensionTypeId,
        memberIds: Object.freeze([...memberIds]),
      });
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
      setSelected(await journals.get({ companyId, voucherId: id }));
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
    setDraft({
      voucherId: selected.id,
      version: selected.version,
      branchId: selected.branchId ?? "",
      voucherDate: selected.voucherDate,
      reference: selected.reference ?? "",
      description: selected.description ?? "",
      lines,
    });
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
          <p className="journal-page__eyebrow">حسابداری / اسناد حسابداری</p>
          <h1>اسناد حسابداری</h1>
          <p>ثبت، ویرایش و کنترل سند دوبل پیش‌نویس</p>
        </div>
        <div className="journal-page__header-actions">
          <button type="button" onClick={() => void reloadList()} disabled={busy}>تازه‌سازی</button>
          <button
            className="journal-button journal-button--primary"
            type="button"
            disabled={!can(journalVoucherPermissions.create)}
            onClick={startNew}
          >
            + سند جدید
          </button>
        </div>
      </header>

      <section className="journal-searchbar" aria-label="جستجوی اسناد">
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
        <label className="journal-searchbar__text">
          جست‌وجو
          <input value={search} placeholder="شماره، مرجع یا شرح سند" onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          از تاریخ
          <PersianDatePicker
            value={dateFrom}
            onChange={setDateFrom}
            ariaLabel="از تاریخ"
            placeholder="از تاریخ شمسی"
          />
        </label>
        <label>
          تا تاریخ
          <PersianDatePicker
            value={dateTo}
            onChange={setDateTo}
            ariaLabel="تا تاریخ"
            placeholder="تا تاریخ شمسی"
          />
        </label>
        <button type="button" onClick={() => void reloadList()} disabled={busy}>جست‌وجو</button>
      </section>

      {companies.length === 0 && !busy && <p className="journal-notice">ابتدا یک شرکت و سال مالی ایجاد کنید.</p>}
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
            <div><h2>فهرست اسناد</h2><small>آخرین اسناد شرکت جاری</small></div>
            <span className="journal-count-badge">{items.length.toLocaleString("fa-IR")}</span>
          </div>
          <div className="journal-list">
            {items.map((item) => (
              <button type="button" className="journal-list__item" key={item.id} onClick={() => void openVoucher(item.id)}>
                <span className="journal-list__number"><b dir="ltr">{item.number}</b><small>{formatJournalVoucherDate(item.voucherDate)}</small></span>
                <span>{item.description || item.reference || "بدون شرح"}</span>
                <strong>{formatJournalRials(item.totalDebit.amount)}</strong>
              </button>
            ))}
            {items.length === 0 && <p className="journal-empty">سندی برای نمایش وجود ندارد.</p>}
          </div>
        </aside>

        <main className="journal-workspace">
          {selected ? (
            <VoucherDetail
              voucher={selected}
              accounts={accounts}
              canEdit={can(journalVoucherPermissions.updateDraft)}
              canDelete={can(journalVoucherPermissions.deleteDraft)}
              onEdit={() => void startEdit()}
              onDelete={() => void removeSelected()}
              onClose={() => setSelected(null)}
            />
          ) : (
            <form className="journal-editor" onSubmit={(event) => void submit(event)}>
              <section className="journal-document-card">
                <div className="journal-section-heading">
                  <div>
                    <p className="journal-page__eyebrow">{draft.voucherId ? "ویرایش پیش‌نویس" : "سند جدید"}</p>
                    <h2>اطلاعات سند</h2>
                  </div>
                  <div className="journal-document-status">
                    <span className="journal-status-badge">پیش‌نویس</span>
                    {draft.voucherId && <span>نسخه {draft.version?.toLocaleString("fa-IR")}</span>}
                  </div>
                </div>

                <div className="journal-document-grid">
                  <label>
                    شرکت
                    <input readOnly value={currentCompany?.legalName ?? "—"} />
                  </label>
                  <label>
                    شماره سند
                    <input readOnly value={draft.voucherId ? "حفظ شماره فعلی" : "خودکار هنگام ذخیره"} />
                  </label>
                  <label>
                    تاریخ سند
                    <PersianDatePicker
                      value={draft.voucherDate}
                      onChange={(value) => { void changeVoucherDate(value); }}
                      ariaLabel="تاریخ سند"
                    />
                  </label>
                  <label>
                    شعبه
                    <select value={draft.branchId} onChange={(event) => setDraft((current) => ({ ...current, branchId: event.target.value }))}>
                      <option value="">بدون شعبه</option>
                      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>)}
                    </select>
                  </label>
                  <label>
                    شماره مرجع
                    <input value={draft.reference} maxLength={100} placeholder="اختیاری" onChange={(event) => setDraft((current) => ({ ...current, reference: event.target.value }))} />
                  </label>
                  <label>
                    منبع
                    <input readOnly value="ثبت دستی" />
                  </label>
                  <label className="journal-document-grid__description">
                    شرح سند
                    <input value={draft.description} placeholder="شرح کلی سند حسابداری" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
                  </label>
                </div>
              </section>

              <section className="journal-lines-card">
                <div className="journal-section-heading journal-section-heading--lines">
                  <div>
                    <h2>آرتیکل‌های سند</h2>
                    <p>حساب، شرح، ابعاد و مبالغ هر ردیف را وارد کنید.</p>
                  </div>
                  <div className="journal-line-actions">
                    <button type="button" onClick={() => setDraft((current) => ({ ...current, lines: [...current.lines, emptyLine()] }))}>+ افزودن ردیف</button>
                  </div>
                </div>

                <div className="journal-entry-table-wrap">
                  <table className="journal-entry-table">
                    <thead>
                      <tr>
                        <th className="journal-col-row">ردیف</th>
                        <th className="journal-col-account">حساب معین *</th>
                        <th className="journal-col-description">شرح</th>
                        {dimensionColumns.map((column) => <th key={column.dimensionTypeId} className="journal-col-dimension">{column.label}</th>)}
                        <th className="journal-col-amount">بدهکار (ریال)</th>
                        <th className="journal-col-amount">بستانکار (ریال)</th>
                        <th className="journal-col-actions">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.lines.map((line, index) => (
                        <JournalEntryRow
                          key={line.key}
                          line={line}
                          index={index}
                          accounts={accounts}
                          selector={dimensions[line.key]}
                          dimensionColumns={dimensionColumns}
                          removable={draft.lines.length > 2}
                          onChooseAccount={(accountId) => void chooseAccount(line.key, accountId)}
                          onUpdate={(changes) => updateLine(line.key, changes)}
                          onChooseDimension={(dimensionTypeId, memberIds) => chooseDimension(line, dimensionTypeId, memberIds)}
                          onRemove={() => {
                            setDraft((current) => ({ ...current, lines: current.lines.filter((value) => value.key !== line.key) }));
                            setDimensions((current) => {
                              const next = { ...current };
                              delete next[line.key];
                              return next;
                            });
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="journal-summary-grid">
                  <section className="journal-summary-panel">
                    <span>جمع بدهکار</span>
                    <strong>{totals.invalid ? "نامعتبر" : formatJournalRials(totals.debit)}</strong>
                  </section>
                  <section className="journal-summary-panel">
                    <span>جمع بستانکار</span>
                    <strong>{totals.invalid ? "نامعتبر" : formatJournalRials(totals.credit)}</strong>
                  </section>
                  <section className="journal-summary-panel">
                    <span>مانده</span>
                    <strong>{totals.invalid ? "نامعتبر" : formatJournalRials(Math.abs(totals.balance))}</strong>
                  </section>
                  <section className={`journal-balance-state ${totals.balanced ? "journal-balance-state--ok" : "journal-balance-state--warning"}`}>
                    {totals.balanced ? "✓ سند تراز است." : "سند تراز نیست."}
                  </section>
                </div>
              </section>

              <footer className="journal-editor-footer">
                <div className="journal-editor-footer__meta">
                  <span>شرکت: <b>{currentCompany?.legalName ?? "—"}</b></span>
                  <span>شعبه: <b>{currentBranch?.name ?? "بدون شعبه"}</b></span>
                  <span>تاریخ: <b>{formatJournalVoucherDate(draft.voucherDate)}</b></span>
                </div>
                <div className="journal-editor-footer__actions">
                  {draft.voucherId && <button type="button" onClick={startNew}>انصراف</button>}
                  <button
                    className="journal-button journal-button--primary"
                    type="submit"
                    disabled={busy || !totals.balanced || !can(draft.voucherId ? journalVoucherPermissions.updateDraft : journalVoucherPermissions.create)}
                  >
                    {busy ? "در حال ذخیره…" : draft.voucherId ? "ذخیره تغییرات" : "ذخیره پیش‌نویس"}
                  </button>
                </div>
              </footer>
            </form>
          )}
        </main>
      </div>
    </section>
  );
}

function JournalEntryRow({
  line,
  index,
  accounts,
  selector,
  dimensionColumns,
  removable,
  onChooseAccount,
  onUpdate,
  onChooseDimension,
  onRemove,
}: {
  readonly line: VoucherLineDraft;
  readonly index: number;
  readonly accounts: readonly JournalAccountOption[];
  readonly selector: AccountingDimensionSelectorModel | undefined;
  readonly dimensionColumns: readonly DimensionColumn[];
  readonly removable: boolean;
  readonly onChooseAccount: (accountId: string) => void;
  readonly onUpdate: (changes: Partial<VoucherLineDraft>) => void;
  readonly onChooseDimension: (dimensionTypeId: string, memberIds: readonly string[]) => void;
  readonly onRemove: () => void;
}) {
  const fields = new Map((selector?.fields ?? []).map((field) => [field.dimensionTypeId, field]));
  return (
    <tr>
      <td className="journal-entry-table__row-number">{(index + 1).toLocaleString("fa-IR")}</td>
      <td>
        <select required value={line.accountId} onChange={(event) => onChooseAccount(event.target.value)}>
          <option value="">انتخاب حساب معین</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}
        </select>
      </td>
      <td>
        <input value={line.description} placeholder="شرح ردیف" onChange={(event) => onUpdate({ description: event.target.value })} />
      </td>
      {dimensionColumns.map((column) => (
        <td key={column.dimensionTypeId}>
          <DimensionCell
            field={fields.get(column.dimensionTypeId)}
            assignment={line.assignments.find((value) => value.dimensionTypeId === column.dimensionTypeId)}
            onChange={(memberIds) => onChooseDimension(column.dimensionTypeId, memberIds)}
          />
        </td>
      ))}
      <td>
        <input
          className="journal-money-input"
          inputMode="numeric"
          dir="ltr"
          value={line.debit}
          placeholder="0"
          onChange={(event) => {
            const value = event.target.value;
            onUpdate({ debit: value, credit: value.trim() && parseRialInput(value) > 0 ? "" : line.credit });
          }}
        />
      </td>
      <td>
        <input
          className="journal-money-input"
          inputMode="numeric"
          dir="ltr"
          value={line.credit}
          placeholder="0"
          onChange={(event) => {
            const value = event.target.value;
            onUpdate({ credit: value, debit: value.trim() && parseRialInput(value) > 0 ? "" : line.debit });
          }}
        />
      </td>
      <td className="journal-entry-table__actions">
        <button type="button" title="حذف ردیف" disabled={!removable} onClick={onRemove}>حذف</button>
      </td>
    </tr>
  );
}

function DimensionCell({
  field,
  assignment,
  onChange,
}: {
  readonly field: AccountingDimensionSelectorField | undefined;
  readonly assignment: AccountingDimensionAssignment | undefined;
  readonly onChange: (memberIds: readonly string[]) => void;
}) {
  if (!field || field.disabled) return <span className="journal-dimension-unavailable">—</span>;
  return (
    <div className="journal-dimension-cell">
      <select
        multiple={field.multiple}
        value={assignment?.memberIds ?? []}
        required={field.required && !field.multiple}
        onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}
      >
        {!field.multiple && <option value="">{field.required ? "انتخاب الزامی" : "انتخاب نشده"}</option>}
        {field.options.map((option) => <option key={option.id} value={option.id}>{option.code} — {option.name}</option>)}
      </select>
      {field.required && <small>الزامی</small>}
    </div>
  );
}

function VoucherDetail({
  voucher,
  accounts,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onClose,
}: {
  readonly voucher: JournalVoucherDto;
  readonly accounts: readonly JournalAccountOption[];
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}) {
  return (
    <section className="journal-detail-card">
      <div className="journal-section-heading">
        <div>
          <p className="journal-page__eyebrow">جزئیات سند</p>
          <h2>سند شماره <span dir="ltr">{voucher.number}</span></h2>
        </div>
        <div className="journal-actions">
          <button type="button" disabled={!canEdit} onClick={onEdit}>ویرایش</button>
          <button type="button" className="journal-button--danger" disabled={!canDelete} onClick={onDelete}>حذف</button>
          <button type="button" onClick={onClose}>بستن</button>
        </div>
      </div>

      <div className="journal-detail-grid">
        <div><dt>تاریخ شمسی</dt><dd>{formatJournalVoucherDate(voucher.voucherDate)}</dd></div>
        <div><dt>تاریخ داخلی</dt><dd dir="ltr">{voucher.voucherDate}</dd></div>
        <div><dt>وضعیت</dt><dd>{journalVoucherStatusLabel()}</dd></div>
        <div><dt>منبع</dt><dd>{journalVoucherSourceLabel(voucher.sourceType)}</dd></div>
        <div><dt>مرجع</dt><dd>{voucher.reference || "—"}</dd></div>
        <div><dt>نسخه</dt><dd>{voucher.version.toLocaleString("fa-IR")}</dd></div>
        <div><dt>سال مالی</dt><dd dir="ltr">{voucher.fiscalYearId}</dd></div>
        <div><dt>دوره مالی</dt><dd dir="ltr">{voucher.fiscalPeriodId}</dd></div>
      </div>

      <p className="journal-detail-description">{voucher.description || "بدون شرح سند"}</p>
      <div className="journal-table-wrap">
        <table className="journal-table">
          <thead><tr><th>ردیف</th><th>حساب</th><th>شرح</th><th>ابعاد حسابداری</th><th>بدهکار</th><th>بستانکار</th></tr></thead>
          <tbody>
            {voucher.lines.map((line) => (
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
          <tfoot><tr><td colSpan={4}>جمع</td><td>{formatJournalRials(voucher.totalDebit.amount)}</td><td>{formatJournalRials(voucher.totalCredit.amount)}</td></tr></tfoot>
        </table>
      </div>
    </section>
  );
}
