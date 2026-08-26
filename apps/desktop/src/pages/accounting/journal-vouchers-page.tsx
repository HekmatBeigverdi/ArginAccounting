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

import "./accounting-workspace.css";
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
const today = () => new Date().toISOString().slice(0, 10);
const lineKey = () => crypto.randomUUID();
const emptyLine = (): VoucherLineDraft => ({
  key: lineKey(),
  id: null,
  accountId: "",
  description: "",
  debit: "",
  credit: "",
  assignments: [],
});
const emptyDraft = (): VoucherDraft => ({
  voucherId: null,
  version: null,
  branchId: "",
  voucherDate: today(),
  reference: "",
  description: "",
  lines: [emptyLine(), emptyLine()],
});

export function JournalVouchersPage() {
  const { journals } = useAccountingServices();
  const { session } = useAuthSession();
  const [companies, setCompanies] = useState<readonly Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState<readonly JournalVoucherListItemDto[]>([]);
  const [selected, setSelected] = useState<JournalVoucherDto | null>(null);
  const [accounts, setAccounts] = useState<readonly JournalAccountOption[]>([]);
  const [branches, setBranches] = useState<readonly JournalBranchOption[]>([]);
  const [draft, setDraft] = useState<VoucherDraft>(emptyDraft);
  const [selectors, setSelectors] = useState<
    Record<string, AccountingDimensionSelectorModel>
  >({});
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [technicalError, setTechnicalError] = useState("");
  const permissions = useMemo(
    () => new Set(session?.user.permissions ?? []),
    [session],
  );
  const can = useCallback(
    (permission: string) =>
      permissions.has("system.full-access") || permissions.has(permission),
    [permissions],
  );
  const currentCompany =
    companies.find((company) => company.id === companyId) ?? null;
  const clearError = useCallback(() => {
    setError("");
    setTechnicalError("");
  }, []);
  const showError = useCallback((reason: unknown) => {
    const presented = presentJournalVoucherError(reason);
    setError(presented.message);
    setTechnicalError(presented.technical ?? "");
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
  const reloadList = useCallback(async () => {
    if (!companyId || !can(journalVoucherPermissions.view)) {
      setItems([]);
      return;
    }
    setBusy(true);
    clearError();
    try {
      const result = await journals.search({
        companyId,
        ...(search.trim() ? { text: search.trim() } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        page: 1,
        pageSize: 100,
      });
      setItems(result.items);
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }, [
    can,
    clearError,
    companyId,
    dateFrom,
    dateTo,
    journals,
    search,
    showError,
  ]);
  useEffect(() => {
    void reloadList();
  }, [reloadList]);
  const loadReferenceData = useCallback(
    async (targetCompanyId: string) => {
      if (!targetCompanyId) return;
      const [accountOptions, branchOptions] = await Promise.all([
        journals.listPostingAccounts(targetCompanyId),
        journals.listBranches(targetCompanyId),
      ]);
      setAccounts(accountOptions);
      setBranches(branchOptions);
    },
    [journals],
  );
  useEffect(() => {
    void loadReferenceData(companyId).catch(showError);
  }, [companyId, loadReferenceData, showError]);
  const startNew = useCallback(() => {
    setSelected(null);
    setSelectors({});
    setDraft({ ...emptyDraft(), branchId: branches[0]?.id ?? "" });
    setMessage("");
    clearError();
  }, [branches, clearError]);
  const loadDimensionsForLine = useCallback(
    async (line: VoucherLineDraft, voucherDate = draft.voucherDate) => {
      if (!companyId || !line.accountId) return;
      const model = await journals.loadDimensionSelector({
        companyId,
        accountId: line.accountId,
        documentDate: voucherDate,
        assignments: line.assignments,
      });
      setSelectors((current) => ({ ...current, [line.key]: model }));
    },
    [companyId, draft.voucherDate, journals],
  );
  const updateLine = useCallback(
    (key: string, changes: Partial<VoucherLineDraft>) => {
      setDraft((current) => ({
        ...current,
        lines: current.lines.map((line) =>
          line.key === key ? { ...line, ...changes } : line,
        ),
      }));
    },
    [],
  );
  const updateAssignment = useCallback(
    (
      line: VoucherLineDraft,
      field: AccountingDimensionSelectorField,
      memberIds: readonly string[],
    ) => {
      const next = line.assignments.filter(
        (assignment) => assignment.dimensionTypeId !== field.dimensionTypeId,
      );
      if (memberIds.length > 0) {
        next.push({ dimensionTypeId: field.dimensionTypeId, memberIds });
      }
      updateLine(line.key, { assignments: next });
    },
    [updateLine],
  );
  const totals = useMemo(
    () =>
      draft.lines.reduce(
        (value, line) => ({
          debit: value.debit + parseRialInput(line.debit),
          credit: value.credit + parseRialInput(line.credit),
        }),
        { debit: 0, credit: 0 },
      ),
    [draft.lines],
  );
  const difference = totals.debit - totals.credit;
  const dimensionColumns = useMemo(() => {
    const columns = new Map<string, AccountingDimensionSelectorField>();
    Object.values(selectors).forEach((selector) => {
      selector.fields.forEach((field) =>
        columns.set(field.dimensionTypeId, field),
      );
    });
    return [...columns.values()];
  }, [selectors]);
  async function openVoucher(id: string): Promise<void> {
    setBusy(true);
    clearError();
    setMessage("");
    try {
      setSelected(await journals.get({ companyId, voucherId: id }));
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }
  async function startEdit(): Promise<void> {
    if (!selected) return;
    setBusy(true);
    clearError();
    try {
      const nextLines = selected.lines.map((line) => ({
        key: lineKey(),
        id: line.id,
        accountId: line.accountId,
        description: line.description ?? "",
        debit: String(line.debit.amount || ""),
        credit: String(line.credit.amount || ""),
        assignments: line.dimensionAssignments,
      }));
      setDraft({
        voucherId: selected.id,
        version: selected.version,
        branchId: selected.branchId ?? "",
        voucherDate: selected.voucherDate,
        reference: selected.reference ?? "",
        description: selected.description ?? "",
        lines: nextLines,
      });
      setSelected(null);
      setSelectors({});
      for (const line of nextLines) {
        if (line.accountId) {
          await loadDimensionsForLine(line, selected.voucherDate);
        }
      }
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!companyId) return;
    setBusy(true);
    clearError();
    setMessage("");
    try {
      const lines = draft.lines.map((line, index) => ({
        id: line.id ?? undefined,
        order: index + 1,
        accountId: line.accountId,
        description: line.description || null,
        debit: parseRialInput(line.debit),
        credit: parseRialInput(line.credit),
        dimensionAssignments: line.assignments,
      }));
      const saved = draft.voucherId
        ? await journals.update({
            context: {
              actorId: session?.user.id ?? "desktop-local-user",
              companyId,
              branchId: draft.branchId || null,
              correlationId: crypto.randomUUID(),
            },
            voucherId: draft.voucherId,
            expectedVersion: draft.version ?? 1,
            voucherDate: draft.voucherDate,
            reference: draft.reference || null,
            description: draft.description || null,
            lines,
          })
        : await journals.create({
            context: {
              actorId: session?.user.id ?? "desktop-local-user",
              companyId,
              branchId: draft.branchId || null,
              correlationId: crypto.randomUUID(),
            },
            voucherDate: draft.voucherDate,
            reference: draft.reference || null,
            description: draft.description || null,
            lines,
          });
      setMessage(
        draft.voucherId
          ? "تغییرات سند ذخیره شد."
          : `سند ${saved.voucher.number} به‌صورت پیش‌نویس ثبت شد.`,
      );
      setDraft(emptyDraft());
      setSelectors({});
      await reloadList();
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }
  const removeSelected = useCallback(async () => {
    if (!selected || !window.confirm(`سند ${selected.number} حذف شود؟`)) return;
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
  const changeVoucherDate = useCallback(
    async (value: string) => {
      setDraft((current) => ({ ...current, voucherDate: value }));
      try {
        for (const line of draft.lines) {
          if (line.accountId) {
            await loadDimensionsForLine(line, value);
          }
        }
      } catch (reason) {
        showError(reason);
      }
    },
    [draft.lines, loadDimensionsForLine, showError],
  );

  return (
    <section className="accounting-workspace journal-page" lang="fa" dir="rtl">
      <header className="accounting-workspace__header journal-page__header">
        <div>
          <p className="accounting-workspace__eyebrow">
            حسابداری / اسناد حسابداری
          </p>
          <h1>اسناد حسابداری</h1>
          <p>ثبت، ویرایش و کنترل سند دوبل پیش‌نویس</p>
        </div>
        <div className="journal-page__header-actions">
          <button
            type="button"
            onClick={() => void reloadList()}
            disabled={busy}
          >
            تازه‌سازی
          </button>
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
          <select
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.target.value);
              setSelected(null);
              startNew();
            }}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.legalName}
              </option>
            ))}
          </select>
        </label>
        <label className="journal-searchbar__text">
          جست‌وجو
          <input
            value={search}
            placeholder="شماره، مرجع یا شرح سند"
            onChange={(event) => setSearch(event.target.value)}
          />
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
        <button type="button" onClick={() => void reloadList()} disabled={busy}>
          جست‌وجو
        </button>
      </section>
      {companies.length === 0 && !busy && (
        <p className="journal-notice">ابتدا یک شرکت و سال مالی ایجاد کنید.</p>
      )}
      {error && (
        <p className="journal-alert journal-alert--error" role="alert">
          {error}
        </p>
      )}
      {technicalError && (
        <details className="journal-technical-error">
          <summary>جزئیات فنی</summary>
          <code dir="ltr">{technicalError}</code>
        </details>
      )}
      {message && (
        <p className="journal-alert journal-alert--success" role="status">
          {message}
        </p>
      )}
      <div className="journal-layout">
        <aside className="journal-list-card">
          <div className="journal-card-title">
            <div>
              <h2>فهرست اسناد</h2>
              <small>آخرین اسناد شرکت جاری</small>
            </div>
            <span className="journal-count-badge">
              {items.length.toLocaleString("fa-IR")}
            </span>
          </div>
          <div className="journal-list">
            {items.map((item) => (
              <button
                type="button"
                className="journal-list__item"
                key={item.id}
                onClick={() => void openVoucher(item.id)}
              >
                <span className="journal-list__number">
                  <b dir="ltr">{item.number}</b>
                  <small>{formatJournalVoucherDate(item.voucherDate)}</small>
                </span>
                <span>{item.description || item.reference || "بدون شرح"}</span>
                <strong>{formatJournalRials(item.totalDebit.amount)}</strong>
              </button>
            ))}
            {items.length === 0 && (
              <p className="journal-empty">سندی برای نمایش وجود ندارد.</p>
            )}
          </div>
        </aside>
        <main className="journal-workspace">
          {selected ? (
            <VoucherDetail
              voucher={selected}
              companyName={
                companies.find((company) => company.id === selected.companyId)?.legalName ??
                selected.companyId
              }
              branchName={
                selected.branchId
                  ? (() => {
                      const branch = branches.find((item) => item.id === selected.branchId);
                      return branch ? `${branch.code} — ${branch.name}` : selected.branchId;
                    })()
                  : "بدون شعبه"
              }
              accounts={accounts}
              canEdit={can(journalVoucherPermissions.updateDraft)}
              canDelete={can(journalVoucherPermissions.deleteDraft)}
              onEdit={() => void startEdit()}
              onDelete={() => void removeSelected()}
              onClose={() => setSelected(null)}
            />
          ) : (
            <form
              className="journal-editor"
              onSubmit={(event) => void submit(event)}
            >
              <section className="journal-document-card">
                <div className="journal-section-heading">
                  <div>
                    <p className="journal-page__eyebrow">
                      {draft.voucherId ? "ویرایش پیش‌نویس" : "سند جدید"}
                    </p>
                    <h2>اطلاعات سند</h2>
                  </div>
                  <div className="journal-document-status">
                    <span className="journal-status-badge">پیش‌نویس</span>
                    {draft.voucherId && (
                      <span>نسخه {draft.version?.toLocaleString("fa-IR")}</span>
                    )}
                  </div>
                </div>
                <div className="journal-document-grid">
                  <label>
                    شرکت
                    <input readOnly value={currentCompany?.legalName ?? "—"} />
                  </label>
                  <label>
                    شماره سند
                    <input
                      readOnly
                      value={
                        draft.voucherId
                          ? "حفظ شماره فعلی"
                          : "خودکار هنگام ذخیره"
                      }
                    />
                  </label>
                  <label>
                    تاریخ سند
                    <PersianDatePicker
                      value={draft.voucherDate}
                      onChange={(value) => {
                        void changeVoucherDate(value);
                      }}
                      ariaLabel="تاریخ سند"
                    />
                  </label>
                  <label>
                    شعبه
                    <select
                      value={draft.branchId}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          branchId: event.target.value,
                        }))
                      }
                    >
                      <option value="">بدون شعبه</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.code} — {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    شماره مرجع
                    <input
                      value={draft.reference}
                      maxLength={100}
                      placeholder="اختیاری"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          reference: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    منبع
                    <input readOnly value="ثبت دستی" />
                  </label>
                  <label className="journal-document-grid__description">
                    شرح سند
                    <input
                      value={draft.description}
                      placeholder="شرح کلی سند حسابداری"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
              <section className="journal-lines-card">
                <div className="journal-section-heading journal-section-heading--lines">
                  <div>
                    <h2>آرتیکل‌های سند</h2>
                    <p>حساب معین، شرح، ابعاد و مبالغ هر ردیف را وارد کنید.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        lines: [...current.lines, emptyLine()],
                      }))
                    }
                  >
                    + ردیف
                  </button>
                </div>
                <div className="journal-entry-table-wrap">
                  <table className="journal-entry-table">
                    <colgroup>
                      <col className="journal-col-row" />
                      <col className="journal-col-account" />
                      <col className="journal-col-description" />
                      {dimensionColumns.map((column) => (
                        <col
                          className="journal-col-dimension"
                          key={column.dimensionTypeId}
                        />
                      ))}
                      <col className="journal-col-amount" />
                      <col className="journal-col-amount" />
                      <col className="journal-col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>ردیف</th>
                        <th>حساب معین</th>
                        <th>شرح</th>
                        {dimensionColumns.map((column) => (
                          <th key={column.dimensionTypeId}>{column.label}</th>
                        ))}
                        <th>بدهکار (ریال)</th>
                        <th>بستانکار (ریال)</th>
                        <th>عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.lines.map((line, index) => (
                        <tr key={line.key}>
                          <td className="journal-entry-table__row-number">
                            {(index + 1).toLocaleString("fa-IR")}
                          </td>
                          <td>
                            <select
                              value={line.accountId}
                              onChange={(event) => {
                                const accountId = event.target.value;
                                updateLine(line.key, {
                                  accountId,
                                  assignments: [],
                                });
                                if (accountId)
                                  void loadDimensionsForLine({
                                    ...line,
                                    accountId,
                                    assignments: [],
                                  });
                              }}
                            >
                              <option value="">انتخاب حساب</option>
                              {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.code} — {account.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              value={line.description}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  description: event.target.value,
                                })
                              }
                            />
                          </td>
                          {dimensionColumns.map((column) => (
                            <td key={column.dimensionTypeId}>
                              <DimensionField
                                line={line}
                                field={selectors[line.key]?.fields.find(
                                  (field) =>
                                    field.dimensionTypeId ===
                                    column.dimensionTypeId,
                                )}
                                onChange={updateAssignment}
                              />
                            </td>
                          ))}
                          <td>
                            <input
                              className="journal-money-input"
                              inputMode="numeric"
                              dir="ltr"
                              value={line.debit}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  debit: event.target.value,
                                  credit: event.target.value ? "" : line.credit,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="journal-money-input"
                              inputMode="numeric"
                              dir="ltr"
                              value={line.credit}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  credit: event.target.value,
                                  debit: event.target.value ? "" : line.debit,
                                })
                              }
                            />
                          </td>
                          <td className="journal-entry-table__actions">
                            <button
                              type="button"
                              disabled={draft.lines.length <= 2}
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  lines: current.lines.filter(
                                    (item) => item.key !== line.key,
                                  ),
                                }))
                              }
                            >
                              حذف
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="journal-summary-grid">
                  <div className="journal-summary-panel">
                    <span>جمع بدهکار</span>
                    <strong>{formatJournalRials(totals.debit)}</strong>
                  </div>
                  <div className="journal-summary-panel">
                    <span>جمع بستانکار</span>
                    <strong>{formatJournalRials(totals.credit)}</strong>
                  </div>
                  <div className="journal-summary-panel">
                    <span>مانده</span>
                    <strong>{formatJournalRials(Math.abs(difference))}</strong>
                  </div>
                  <div
                    className={`journal-balance-state ${difference === 0 && totals.debit > 0 ? "journal-balance-state--ok" : "journal-balance-state--warning"}`}
                  >
                    {difference === 0 && totals.debit > 0
                      ? "سند تراز است"
                      : "سند تراز نیست"}
                  </div>
                </div>
              </section>
              <footer className="journal-editor-footer">
                <div className="journal-editor-footer__meta">
                  <span>
                    واحد پول: <b>ریال</b>
                  </span>
                  <span>
                    تقویم: <b>هجری شمسی</b>
                  </span>
                  <span>
                    ذخیره‌سازی تاریخ: <b>Gregorian ISO</b>
                  </span>
                </div>
                <div className="journal-editor-footer__actions">
                  <button type="button" onClick={startNew}>
                    پاک‌کردن فرم
                  </button>
                  <button
                    className="journal-button journal-button--primary"
                    type="submit"
                    disabled={
                      busy ||
                      !(draft.voucherId
                        ? can(journalVoucherPermissions.updateDraft)
                        : can(journalVoucherPermissions.create))
                    }
                  >
                    {busy
                      ? "در حال ذخیره…"
                      : draft.voucherId
                        ? "ذخیره تغییرات"
                        : "ثبت پیش‌نویس"}
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

function DimensionField({
  line,
  field,
  onChange,
}: {
  line: VoucherLineDraft;
  field?: AccountingDimensionSelectorField;
  onChange: (
    line: VoucherLineDraft,
    field: AccountingDimensionSelectorField,
    memberIds: readonly string[],
  ) => void;
}) {
  if (!line.accountId)
    return <span className="journal-dimension-unavailable">ابتدا حساب</span>;
  if (!field) return <span className="journal-dimension-unavailable">—</span>;
  const assignment = line.assignments.find(
    (item) => item.dimensionTypeId === field.dimensionTypeId,
  );
  const selectedIds = assignment?.memberIds ?? field.selectedMemberIds;
  if (field.multiple)
    return (
      <select
        multiple
        disabled={field.disabled}
        aria-label={field.label}
        value={[...selectedIds]}
        onChange={(event) =>
          onChange(
            line,
            field,
            Array.from(event.currentTarget.selectedOptions).map(
              (option) => option.value,
            ),
          )
        }
      >
        {field.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.code} — {option.name}
          </option>
        ))}
      </select>
    );
  return (
    <select
      disabled={field.disabled}
      aria-label={field.label}
      value={selectedIds[0] ?? ""}
      onChange={(event) =>
        onChange(line, field, event.target.value ? [event.target.value] : [])
      }
    >
      <option value="">
        {field.required ? "انتخاب کنید *" : "بدون انتخاب"}
      </option>
      {field.options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.code} — {option.name}
        </option>
      ))}
    </select>
  );
}
function VoucherDetail({
  voucher,
  companyName,
  branchName,
  accounts,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onClose,
}: {
  voucher: JournalVoucherDto;
  companyName: string;
  branchName: string;
  accounts: readonly JournalAccountOption[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const accountNames = new Map(
    accounts.map((account) => [
      account.id,
      `${account.code} — ${account.name}`,
    ]),
  );
  return (
    <section className="journal-detail-card">
      <div className="journal-section-heading">
        <div>
          <p className="journal-page__eyebrow">مشاهده سند</p>
          <h2>سند {voucher.number}</h2>
        </div>
        <div className="journal-actions">
          <span className="journal-status-badge">
            {journalVoucherStatusLabel()}
          </span>
          <button type="button" onClick={onClose}>
            بستن
          </button>
          {canEdit && (
            <button type="button" onClick={onEdit}>
              ویرایش
            </button>
          )}
          {canDelete && (
            <button
              className="journal-button--danger"
              type="button"
              onClick={onDelete}
            >
              حذف
            </button>
          )}
        </div>
      </div>
      <dl className="journal-detail-grid">
        <div>
          <dt>تاریخ</dt>
          <dd>{formatJournalVoucherDate(voucher.voucherDate)}</dd>
        </div>
        <div>
          <dt>شرکت</dt>
          <dd>{companyName}</dd>
        </div>
        <div>
          <dt>شعبه</dt>
          <dd>{branchName}</dd>
        </div>
        <div>
          <dt>منبع</dt>
          <dd>{journalVoucherSourceLabel(voucher.sourceType)}</dd>
        </div>
        <div>
          <dt>مرجع</dt>
          <dd>{voucher.reference ?? "—"}</dd>
        </div>
        <div>
          <dt>نسخه</dt>
          <dd>{voucher.version.toLocaleString("fa-IR")}</dd>
        </div>
        <div>
          <dt>ایجاد</dt>
          <dd>
            {new Date(voucher.createdAt).toLocaleString("fa-IR-u-ca-persian")}
          </dd>
        </div>
        <div>
          <dt>آخرین تغییر</dt>
          <dd>
            {new Date(voucher.updatedAt).toLocaleString("fa-IR-u-ca-persian")}
          </dd>
        </div>
      </dl>
      <p className="journal-detail-description">
        {voucher.description || "بدون شرح کلی"}
      </p>
      <div className="journal-table-wrap">
        <table className="journal-table">
          <thead>
            <tr>
              <th>ردیف</th>
              <th>حساب</th>
              <th>شرح</th>
              <th>بدهکار</th>
              <th>بستانکار</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.order.toLocaleString("fa-IR")}</td>
                <td>{accountNames.get(line.accountId) ?? line.accountId}</td>
                <td>{line.description ?? "—"}</td>
                <td>{formatJournalRials(line.debit.amount)}</td>
                <td>{formatJournalRials(line.credit.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>جمع</td>
              <td>{formatJournalRials(voucher.totalDebit.amount)}</td>
              <td>{formatJournalRials(voucher.totalCredit.amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
