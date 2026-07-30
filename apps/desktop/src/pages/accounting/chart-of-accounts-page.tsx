import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  chartOfAccountsPermissions,
  type Account,
  type AccountCodingSettings,
  type AccountLevel,
  type AccountNature,
  type AccountStatementType,
  type NormalBalance
} from "@argin/accounting";
import type { Company } from "@argin/company";
import { SqliteCompanyRepository } from "@argin/company-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useAuthSession } from "../../app/providers/auth-session-provider";
import { useAccountingServices } from "../../composition/accounting/accounting-provider";
import {
  accountLevelLabels,
  flattenAccountTree,
  getAccountingErrorMessage
} from "../../features/accounting/chart-of-accounts-presenter";

import "./chart-of-accounts-page.css";

interface AccountDraft {
  level: AccountLevel;
  parentId: string;
  code: string;
  name: string;
  englishName: string;
  nature: AccountNature;
  normalBalance: NormalBalance;
  statementType: AccountStatementType;
  postingAllowed: boolean;
}

const emptyDraft: AccountDraft = {
  level: "group",
  parentId: "",
  code: "",
  name: "",
  englishName: "",
  nature: "uncontrolled",
  normalBalance: "debit",
  statementType: "balance_sheet",
  postingAllowed: false
};

export function ChartOfAccountsPage() {
  const { chartOfAccounts } = useAccountingServices();
  const { session } = useAuthSession();
  const [companies, setCompanies] = useState<readonly Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [settings, setSettings] =
    useState<AccountCodingSettings | null>(null);
  const [draft, setDraft] = useState<AccountDraft>(emptyDraft);
  const [editing, setEditing] = useState<Account | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"" | Account["status"]>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const permissions = useMemo(
    () => new Set(session?.user.permissions ?? []),
    [session]
  );
  const can = useCallback(
    (permission: string) =>
      permissions.has("system.full-access") ||
      permissions.has(permission),
    [permissions]
  );

  useEffect(() => {
    void getDesktopDatabase()
      .then((database) =>
        new SqliteCompanyRepository(database).findAll()
      )
      .then((values) => {
        setCompanies(values);
        setCompanyId((current) => current || values[0]?.id || "");
      })
      .catch((reason: unknown) => {
        setError(getAccountingErrorMessage(reason));
      });
  }, []);

  const reload = useCallback(async () => {
    if (companyId.length === 0) {
      setAccounts([]);
      setSettings(null);
      return;
    }
    setBusy(true);
    setError("");
    try {
      let loadedSettings: AccountCodingSettings;
      try {
        loadedSettings = await chartOfAccounts.getCodingSettings(companyId);
      } catch (reason) {
        if (
          can(chartOfAccountsPermissions.manageSettings) &&
          reason !== null &&
          typeof reason === "object" &&
          "code" in reason &&
          reason.code === "CODING_SETTINGS_NOT_FOUND"
        ) {
          loadedSettings =
            await chartOfAccounts.saveDefaultCodingSettings(companyId);
        } else {
          throw reason;
        }
      }
      const tree = await chartOfAccounts.getAccountTree(companyId);
      setSettings(loadedSettings);
      setAccounts(flattenAccountTree(tree).map(({ account }) => account));
    } catch (reason) {
      setError(getAccountingErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }, [can, chartOfAccounts, companyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visibleAccounts = useMemo(() => {
    const text = search.trim().toLocaleLowerCase("fa");
    return accounts.filter((account) =>
      (statusFilter === "" || account.status === statusFilter) &&
      (
        text.length === 0 ||
        account.code.includes(text) ||
        account.name.toLocaleLowerCase("fa").includes(text)
      )
    );
  }, [accounts, search, statusFilter]);

  function startCreate(parent?: Account): void {
    const level: AccountLevel = parent === undefined
      ? "group"
      : parent.level === "group"
      ? "general"
      : "subsidiary";
    setEditing(null);
    setDraft({
      ...emptyDraft,
      level,
      parentId: parent?.id ?? "",
      postingAllowed: level === "subsidiary"
    });
    setMessage("");
    setError("");
  }

  function startEdit(account: Account): void {
    setEditing(account);
    setDraft({
      level: account.level,
      parentId: account.parentId ?? "",
      code: account.code,
      name: account.name,
      englishName: account.englishName ?? "",
      nature: account.nature,
      normalBalance: account.normalBalance,
      statementType: account.statementType,
      postingAllowed: account.postingAllowed
    });
    setMessage("");
    setError("");
  }

  async function submitAccount(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    if (companyId.length === 0) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const values = {
        parentId: draft.parentId || null,
        level: draft.level,
        code: draft.code,
        name: draft.name,
        englishName: draft.englishName || null,
        nature: draft.nature,
        normalBalance: draft.normalBalance,
        statementType: draft.statementType,
        postingAllowed:
          draft.level === "subsidiary" && draft.postingAllowed
      };
      if (editing === null) {
        await chartOfAccounts.createAccount({ companyId, ...values });
        setMessage("حساب جدید با موفقیت ایجاد شد.");
      } else {
        await chartOfAccounts.updateAccount({
          companyId,
          accountId: editing.id,
          expectedVersion: editing.version,
          changes: values
        });
        setMessage("تغییرات حساب ذخیره شد.");
      }
      setEditing(null);
      setDraft(emptyDraft);
      await reload();
    } catch (reason) {
      setError(getAccountingErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(account: Account): Promise<void> {
    setBusy(true);
    setError("");
    try {
      await chartOfAccounts.setAccountStatus(
        companyId,
        account.id,
        account.status === "active" ? "inactive" : "active",
        account.version
      );
      setMessage(
        account.status === "active"
          ? "حساب غیرفعال شد."
          : "حساب فعال شد."
      );
      await reload();
    } catch (reason) {
      setError(getAccountingErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount(account: Account): Promise<void> {
    if (!window.confirm(`حساب «${account.name}» حذف شود؟`)) return;
    setBusy(true);
    setError("");
    try {
      await chartOfAccounts.deleteAccount({
        companyId,
        accountId: account.id,
        expectedVersion: account.version
      });
      setMessage("حساب حذف شد.");
      await reload();
    } catch (reason) {
      setError(getAccountingErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    if (settings === null) return;
    setBusy(true);
    setError("");
    try {
      const updated = await chartOfAccounts.updateCodingSettings({
        ...settings,
        expectedVersion: settings.version
      });
      setSettings(updated);
      setMessage("تنظیمات کدینگ ذخیره شد.");
    } catch (reason) {
      setError(getAccountingErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="coa-page" lang="fa" dir="rtl">
      <header className="coa-page__header">
        <div>
          <p className="coa-page__eyebrow">حسابداری / اطلاعات پایه</p>
          <h1>درخت حساب‌ها</h1>
          <p>تعریف و نگهداری ساختار گروه، کل و معین شرکت</p>
        </div>
        <button
          type="button"
          className="coa-button coa-button--primary"
          disabled={
            !can(chartOfAccountsPermissions.create) || companyId === ""
          }
          onClick={() => startCreate()}
        >
          حساب گروه جدید
        </button>
      </header>

      <div className="coa-toolbar">
        <label>
          شرکت
          <select
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.legalName}
              </option>
            ))}
          </select>
        </label>
        <label className="coa-toolbar__search">
          جست‌وجو
          <input
            value={search}
            placeholder="کد یا عنوان حساب"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          وضعیت
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "" | Account["status"]
              )
            }
          >
            <option value="">همه</option>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </select>
        </label>
        <button type="button" onClick={() => void reload()} disabled={busy}>
          تازه‌سازی
        </button>
      </div>

      {companies.length === 0 && !busy && (
        <p className="coa-notice" role="status">
          ابتدا از بخش «تعریف شرکت» یک شرکت ایجاد کنید.
        </p>
      )}
      {error && (
        <p className="coa-alert coa-alert--error" role="alert">{error}</p>
      )}
      {message && (
        <p className="coa-alert coa-alert--success" role="status">{message}</p>
      )}

      <div className="coa-layout">
        <div className="coa-tree-card">
          <div className="coa-tree-card__title">
            <h2>ساختار حساب‌ها</h2>
            <span>{visibleAccounts.length.toLocaleString("fa-IR")} حساب</span>
          </div>
          <div className="coa-table-wrap">
            <table className="coa-table">
              <thead>
                <tr>
                  <th>کد و عنوان</th>
                  <th>سطح</th>
                  <th>مانده عادی</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {visibleAccounts.map((account) => {
                  const depth = account.level === "group"
                    ? 0
                    : account.level === "general"
                    ? 1
                    : 2;
                  return (
                    <tr key={account.id}>
                      <td>
                        <div
                          className="coa-account-title"
                          style={{
                            paddingInlineStart: `${depth * 1.5}rem`
                          }}
                        >
                          <span
                            className="coa-account-title__branch"
                            aria-hidden="true"
                          >
                            {depth > 0 ? "↳" : "●"}
                          </span>
                          <b dir="ltr">{account.code}</b>
                          <span>{account.name}</span>
                        </div>
                      </td>
                      <td>{accountLevelLabels[account.level]}</td>
                      <td>
                        {account.normalBalance === "debit"
                          ? "بدهکار"
                          : "بستانکار"}
                      </td>
                      <td>
                        <span
                          className={`coa-badge coa-badge--${account.status}`}
                        >
                          {account.status === "active" ? "فعال" : "غیرفعال"}
                        </span>
                      </td>
                      <td className="coa-actions">
                        {account.level !== "subsidiary" &&
                          can(chartOfAccountsPermissions.create) && (
                          <button
                            type="button"
                            onClick={() => startCreate(account)}
                          >
                            افزودن زیرحساب
                          </button>
                        )}
                        {can(chartOfAccountsPermissions.update) && (
                          <button
                            type="button"
                            onClick={() => startEdit(account)}
                          >
                            ویرایش
                          </button>
                        )}
                        {can(chartOfAccountsPermissions.changeStatus) && (
                          <button
                            type="button"
                            onClick={() => void toggleStatus(account)}
                          >
                            {account.status === "active"
                              ? "غیرفعال‌سازی"
                              : "فعال‌سازی"}
                          </button>
                        )}
                        {can(chartOfAccountsPermissions.delete) && (
                          <button
                            type="button"
                            className="coa-action--danger"
                            onClick={() => void removeAccount(account)}
                          >
                            حذف
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visibleAccounts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="coa-empty">
                      حسابی برای نمایش وجود ندارد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="coa-side">
          <form
            className="coa-card"
            onSubmit={(event) => void submitAccount(event)}
          >
            <div className="coa-card__title">
              <h2>{editing === null ? "تعریف حساب" : "ویرایش حساب"}</h2>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setDraft(emptyDraft);
                  }}
                >
                  انصراف
                </button>
              )}
            </div>
            <label>
              سطح حساب
              <select
                value={draft.level}
                disabled={editing !== null || draft.parentId !== ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    level: event.target.value as AccountLevel
                  }))
                }
              >
                <option value="group">گروه</option>
                <option value="general">کل</option>
                <option value="subsidiary">معین</option>
              </select>
            </label>
            {draft.level !== "group" && (
              <label>
                حساب والد
                <select
                  required
                  value={draft.parentId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      parentId: event.target.value
                    }))
                  }
                >
                  <option value="">انتخاب کنید</option>
                  {accounts
                    .filter((account) =>
                      account.level === (
                        draft.level === "general" ? "group" : "general"
                      )
                    )
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} — {account.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <div className="coa-fields-row">
              <label>
                کد حساب
                <input
                  required
                  inputMode="numeric"
                  dir="ltr"
                  value={draft.code}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      code: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                عنوان فارسی
                <input
                  required
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                />
              </label>
            </div>
            <label>
              عنوان انگلیسی (اختیاری)
              <input
                dir="ltr"
                value={draft.englishName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    englishName: event.target.value
                  }))
                }
              />
            </label>
            <div className="coa-fields-row">
              <label>
                ماهیت
                <select
                  value={draft.nature}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      nature: event.target.value as AccountNature
                    }))
                  }
                >
                  <option value="uncontrolled">کنترل‌نشده</option>
                  <option value="debit">بدهکار</option>
                  <option value="credit">بستانکار</option>
                  <option value="strict_debit">صرفاً بدهکار</option>
                  <option value="strict_credit">صرفاً بستانکار</option>
                </select>
              </label>
              <label>
                مانده عادی
                <select
                  value={draft.normalBalance}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      normalBalance:
                        event.target.value as NormalBalance
                    }))
                  }
                >
                  <option value="debit">بدهکار</option>
                  <option value="credit">بستانکار</option>
                </select>
              </label>
            </div>
            <label>
              صورت مالی
              <select
                value={draft.statementType}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    statementType:
                      event.target.value as AccountStatementType
                  }))
                }
              >
                <option value="balance_sheet">ترازنامه</option>
                <option value="income_statement">سود و زیان</option>
                <option value="memorandum">انتظامی</option>
              </select>
            </label>
            {draft.level === "subsidiary" && (
              <label className="coa-check">
                <input
                  type="checkbox"
                  checked={draft.postingAllowed}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      postingAllowed: event.target.checked
                    }))
                  }
                />
                ثبت سند روی این حساب مجاز باشد
              </label>
            )}
            <button
              className="coa-button coa-button--primary"
              type="submit"
              disabled={
                busy ||
                (
                  editing === null
                    ? !can(chartOfAccountsPermissions.create)
                    : !can(chartOfAccountsPermissions.update)
                )
              }
            >
              {busy
                ? "در حال انجام…"
                : editing === null
                ? "ایجاد حساب"
                : "ذخیره تغییرات"}
            </button>
          </form>

          {settings && (
            <form
              className="coa-card"
              onSubmit={(event) => void saveSettings(event)}
            >
              <div className="coa-card__title">
                <h2>تنظیمات کدینگ</h2>
                <span>نسخه {settings.version.toLocaleString("fa-IR")}</span>
              </div>
              <div className="coa-settings-grid">
                {([
                  ["groupCodeLength", "طول کد گروه"],
                  ["generalCodeLength", "طول کد کل"],
                  ["subsidiaryCodeLength", "طول کد معین"]
                ] as const).map(([field, label]) => (
                  <label key={field}>
                    {label}
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={settings[field]}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          [field]: Number(event.target.value)
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="coa-check">
                <input
                  type="checkbox"
                  checked={settings.enforceHierarchicalCodes}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      enforceHierarchicalCodes: event.target.checked
                    })
                  }
                />
                الزام پیشوند سلسله‌مراتبی
              </label>
              <label className="coa-check">
                <input
                  type="checkbox"
                  checked={settings.allowCodeChangeAfterUse}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      allowCodeChangeAfterUse: event.target.checked
                    })
                  }
                />
                اجازه تغییر کد پس از استفاده
              </label>
              <button
                type="submit"
                disabled={
                  busy ||
                  !can(chartOfAccountsPermissions.manageSettings)
                }
              >
                ذخیره تنظیمات
              </button>
            </form>
          )}
        </aside>
      </div>
    </section>
  );
}
