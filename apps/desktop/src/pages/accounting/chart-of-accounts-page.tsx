import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  chartOfAccountsPermissions,
  type Account,
  type AccountCodingSettings,
  type AccountLevel,
  type AccountNature,
  type AccountStatementType,
  type NormalBalance,
} from "@argin/accounting";
import type { Company } from "@argin/company";
import { SqliteCompanyRepository } from "@argin/company-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Badge } from "../../components/data-display";
import { Feedback } from "../../components/feedback";
import { Button, Field, Input, Select } from "../../components/forms";
import { Page, Panel, Toolbar } from "../../components/layout";
import { useAccountingServices } from "../../composition/accounting/accounting-provider";
import {
  accountLevelLabels,
  flattenAccountTree,
  getAccountingErrorMessage,
} from "../../features/accounting/chart-of-accounts-presenter";

import "./accounting-workspace.css";
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

interface AccountTreeRow {
  readonly account: Account;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly isExpanded: boolean;
}

type AccountTreeStyle = CSSProperties & { "--coa-depth": number };

const emptyDraft: AccountDraft = {
  level: "group",
  parentId: "",
  code: "",
  name: "",
  englishName: "",
  nature: "uncontrolled",
  normalBalance: "debit",
  statementType: "balance_sheet",
  postingAllowed: false,
};

function accountMatches(account: Account, text: string, statusFilter: "" | Account["status"]): boolean {
  return (statusFilter === "" || account.status === statusFilter) && (
    text.length === 0 ||
    account.code.toLocaleLowerCase("fa").includes(text) ||
    account.name.toLocaleLowerCase("fa").includes(text) ||
    (account.englishName ?? "").toLocaleLowerCase().includes(text)
  );
}

function buildVisibleTreeRows(
  accounts: readonly Account[],
  collapsed: ReadonlySet<string>,
  search: string,
  statusFilter: "" | Account["status"],
): readonly AccountTreeRow[] {
  const byParent = new Map<string | null, Account[]>();
  for (const account of accounts) {
    const siblings = byParent.get(account.parentId) ?? [];
    siblings.push(account);
    byParent.set(account.parentId, siblings);
  }
  const text = search.trim().toLocaleLowerCase("fa");
  const filtering = text.length > 0 || statusFilter !== "";
  const visibleIds = new Set<string>();

  if (filtering) {
    const byId = new Map(accounts.map((account) => [account.id, account] as const));
    for (const account of accounts) {
      if (!accountMatches(account, text, statusFilter)) continue;
      let current: Account | undefined = account;
      while (current) {
        visibleIds.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    }
  }

  const rows: AccountTreeRow[] = [];
  const visit = (parentId: string | null, depth: number): void => {
    for (const account of byParent.get(parentId) ?? []) {
      if (filtering && !visibleIds.has(account.id)) continue;
      const children = byParent.get(account.id) ?? [];
      const hasChildren = children.some((child) => !filtering || visibleIds.has(child.id));
      const isExpanded = filtering || !collapsed.has(account.id);
      rows.push({ account, depth, hasChildren, isExpanded });
      if (hasChildren && isExpanded) visit(account.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

export function ChartOfAccountsPage() {
  const { chartOfAccounts } = useAccountingServices();
  const { session } = useAuthSession();
  const [companies, setCompanies] = useState<readonly Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [settings, setSettings] = useState<AccountCodingSettings | null>(null);
  const [draft, setDraft] = useState<AccountDraft>(emptyDraft);
  const [editing, setEditing] = useState<Account | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | Account["status"]>("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const permissions = useMemo(() => new Set(session?.user.permissions ?? []), [session]);
  const can = useCallback(
    (permission: string) => permissions.has("system.full-access") || permissions.has(permission),
    [permissions],
  );

  useEffect(() => {
    void getDesktopDatabase()
      .then((database) => new SqliteCompanyRepository(database).findAll())
      .then((values) => {
        setCompanies(values);
        setCompanyId((current) => current || values[0]?.id || "");
      })
      .catch((reason: unknown) => setError(getAccountingErrorMessage(reason)));
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
          loadedSettings = await chartOfAccounts.saveDefaultCodingSettings(companyId);
        } else {
          throw reason;
        }
      }
      const tree = await chartOfAccounts.getAccountTree(companyId);
      setSettings(loadedSettings);
      setAccounts(flattenAccountTree(tree).map(({ account }) => account));
      setCollapsed(new Set());
    } catch (reason) {
      setError(getAccountingErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }, [can, chartOfAccounts, companyId]);

  useEffect(() => { void reload(); }, [reload]);

  const treeRows = useMemo(
    () => buildVisibleTreeRows(accounts, collapsed, search, statusFilter),
    [accounts, collapsed, search, statusFilter],
  );
  const groupCount = accounts.filter((account) => account.level === "group").length;
  const generalCount = accounts.filter((account) => account.level === "general").length;
  const subsidiaryCount = accounts.filter((account) => account.level === "subsidiary").length;

  function toggleNode(accountId: string): void {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  function expandAll(): void { setCollapsed(new Set()); }
  function collapseAll(): void {
    setCollapsed(new Set(accounts.filter((account) => account.level !== "subsidiary").map((account) => account.id)));
  }

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
      postingAllowed: level === "subsidiary",
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
      postingAllowed: account.postingAllowed,
    });
    setMessage("");
    setError("");
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
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
        postingAllowed: draft.level === "subsidiary" && draft.postingAllowed,
      };
      if (editing === null) {
        await chartOfAccounts.createAccount({ companyId, ...values });
        setMessage("حساب جدید با موفقیت ایجاد شد.");
      } else {
        await chartOfAccounts.updateAccount({ companyId, accountId: editing.id, expectedVersion: editing.version, changes: values });
        setMessage("تغییرات حساب ذخیره شد.");
      }
      setEditing(null);
      setDraft(emptyDraft);
      await reload();
    } catch (reason) { setError(getAccountingErrorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function toggleStatus(account: Account): Promise<void> {
    setBusy(true); setError("");
    try {
      await chartOfAccounts.setAccountStatus(companyId, account.id, account.status === "active" ? "inactive" : "active", account.version);
      setMessage(account.status === "active" ? "حساب غیرفعال شد." : "حساب فعال شد.");
      await reload();
    } catch (reason) { setError(getAccountingErrorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function removeAccount(account: Account): Promise<void> {
    if (!window.confirm(`حساب «${account.name}» حذف شود؟`)) return;
    setBusy(true); setError("");
    try {
      await chartOfAccounts.deleteAccount({ companyId, accountId: account.id, expectedVersion: account.version });
      setMessage("حساب حذف شد."); await reload();
    } catch (reason) { setError(getAccountingErrorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (settings === null) return; setBusy(true); setError("");
    try { const updated = await chartOfAccounts.updateCodingSettings({ ...settings, expectedVersion: settings.version }); setSettings(updated); setMessage("تنظیمات کدینگ ذخیره شد."); }
    catch (reason) { setError(getAccountingErrorMessage(reason)); }
    finally { setBusy(false); }
  }

  return (
    <Page className="accounting-workspace coa-page" lang="fa" dir="rtl">
      <header className="accounting-workspace__header">
        <div><p className="accounting-workspace__eyebrow">حسابداری / اطلاعات پایه</p><h1>درخت حساب‌ها</h1><p>ساختار گروه، کل و معین را با نمای سلسله‌مراتبی یکپارچه مدیریت کنید.</p></div>
        <Button type="button" variant="primary" disabled={!can(chartOfAccountsPermissions.create) || companyId === ""} onClick={() => startCreate()}>+ حساب گروه جدید</Button>
      </header>
      <Toolbar className="accounting-workspace__toolbar coa-toolbar">
        <Field label="شرکت" className="coa-toolbar__company"><Select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>{companies.map((company) => <option key={company.id} value={company.id}>{company.legalName}</option>)}</Select></Field>
        <Field label="جست‌وجو" className="coa-toolbar__search"><Input value={search} placeholder="کد، عنوان فارسی یا انگلیسی" onChange={(event) => setSearch(event.target.value)} /></Field>
        <Field label="وضعیت" className="coa-toolbar__status"><Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "" | Account["status"])}><option value="">همه</option><option value="active">فعال</option><option value="inactive">غیرفعال</option></Select></Field>
        <Button type="button" onClick={() => void reload()} disabled={busy}>تازه‌سازی</Button>
      </Toolbar>
      {companies.length === 0 && !busy ? <Feedback tone="warning">ابتدا از بخش «شرکت‌ها و شعب» یک شرکت ایجاد کنید.</Feedback> : null}
      {error ? <Feedback tone="error">{error}</Feedback> : null}{message ? <Feedback tone="success">{message}</Feedback> : null}
      <div className="coa-summary" aria-label="خلاصه ساختار حساب‌ها"><Panel className="coa-summary__item"><span>کل حساب‌ها</span><strong>{accounts.length.toLocaleString("fa-IR")}</strong></Panel><Panel className="coa-summary__item coa-summary__item--group"><span>گروه</span><strong>{groupCount.toLocaleString("fa-IR")}</strong></Panel><Panel className="coa-summary__item coa-summary__item--general"><span>کل</span><strong>{generalCount.toLocaleString("fa-IR")}</strong></Panel><Panel className="coa-summary__item coa-summary__item--subsidiary"><span>معین</span><strong>{subsidiaryCount.toLocaleString("fa-IR")}</strong></Panel></div>
      <div className="coa-layout">
        <Panel className="coa-tree-card">
          <div className="coa-tree-card__title"><div><h2>ساختار حساب‌ها</h2><p>شاخه‌ها را باز یا بسته کنید؛ در جست‌وجو مسیر والد حساب‌های منطبق حفظ می‌شود.</p></div><div className="coa-tree-card__controls"><Badge tone="info">{treeRows.length.toLocaleString("fa-IR")} ردیف</Badge><Button type="button" compact onClick={expandAll}>بازکردن همه</Button><Button type="button" compact onClick={collapseAll}>بستن همه</Button></div></div>
          <div className="coa-tree" role="tree" aria-label="درخت حساب‌ها">
            {treeRows.map(({ account, depth, hasChildren, isExpanded }) => (
              <article key={account.id} className={`coa-tree__row coa-tree__row--${account.level} ${account.status === "inactive" ? "coa-tree__row--inactive" : ""}`} role="treeitem" aria-level={depth + 1} aria-expanded={hasChildren ? isExpanded : undefined} style={{ "--coa-depth": depth } as AccountTreeStyle}>
                <div className="coa-tree__identity"><span className="coa-tree__rail" aria-hidden="true" />{hasChildren ? <button type="button" className="coa-tree__toggle" aria-label={isExpanded ? `بستن شاخه ${account.name}` : `باز کردن شاخه ${account.name}`} onClick={() => toggleNode(account.id)}>{isExpanded ? "−" : "+"}</button> : <span className="coa-tree__leaf" aria-hidden="true">•</span>}<span className={`coa-tree__level-marker coa-tree__level-marker--${account.level}`} aria-hidden="true">{account.level === "group" ? "گ" : account.level === "general" ? "ک" : "م"}</span><div className="coa-tree__title"><div><code dir="ltr">{account.code}</code><strong>{account.name}</strong></div>{account.englishName ? <small dir="ltr">{account.englishName}</small> : null}</div></div>
                <div className="coa-tree__meta"><Badge tone={account.level === "group" ? "info" : account.level === "general" ? "warning" : "neutral"}>{accountLevelLabels[account.level]}</Badge><span>{account.normalBalance === "debit" ? "بدهکار" : "بستانکار"}</span>{account.postingAllowed ? <Badge tone="success">قابل ثبت</Badge> : <span className="coa-tree__posting-muted">غیرقابل ثبت</span>}<Badge tone={account.status === "active" ? "success" : "neutral"}>{account.status === "active" ? "فعال" : "غیرفعال"}</Badge></div>
                <div className="coa-tree__actions">{account.level !== "subsidiary" && can(chartOfAccountsPermissions.create) ? <Button type="button" compact onClick={() => startCreate(account)}>+ زیرحساب</Button> : null}{can(chartOfAccountsPermissions.update) ? <Button type="button" compact onClick={() => startEdit(account)}>ویرایش</Button> : null}{can(chartOfAccountsPermissions.changeStatus) ? <Button type="button" compact onClick={() => void toggleStatus(account)}>{account.status === "active" ? "غیرفعال" : "فعال"}</Button> : null}{can(chartOfAccountsPermissions.delete) ? <Button type="button" compact variant="danger" onClick={() => void removeAccount(account)}>حذف</Button> : null}</div>
              </article>
            ))}
            {treeRows.length === 0 ? <div className="coa-empty">حسابی مطابق فیلترهای فعلی وجود ندارد.</div> : null}
          </div>
        </Panel>
        <aside className="coa-side">
          <Panel className="coa-card"><form className="coa-form" onSubmit={(event) => void submitAccount(event)}><div className="coa-card__title"><div><h2>{editing === null ? "تعریف حساب" : "ویرایش حساب"}</h2><p>{editing === null ? "حساب جدید را در سطح مناسب ایجاد کنید." : "مشخصات حساب انتخاب‌شده را اصلاح کنید."}</p></div>{editing ? <Button type="button" compact variant="ghost" onClick={() => { setEditing(null); setDraft(emptyDraft); }}>انصراف</Button> : null}</div><Field label="سطح حساب"><Select value={draft.level} disabled={editing !== null || draft.parentId !== ""} onChange={(event) => setDraft((current) => ({ ...current, level: event.target.value as AccountLevel }))}><option value="group">گروه</option><option value="general">کل</option><option value="subsidiary">معین</option></Select></Field>{draft.level !== "group" ? <Field label="حساب والد"><Select required value={draft.parentId} onChange={(event) => setDraft((current) => ({ ...current, parentId: event.target.value }))}><option value="">انتخاب کنید</option>{accounts.filter((account) => account.level === (draft.level === "general" ? "group" : "general")).map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</Select></Field> : null}<div className="coa-fields-row"><Field label="کد حساب"><Input required inputMode="numeric" dir="ltr" value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} /></Field><Field label="عنوان فارسی"><Input required value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></Field></div><Field label="عنوان انگلیسی (اختیاری)"><Input dir="ltr" value={draft.englishName} onChange={(event) => setDraft((current) => ({ ...current, englishName: event.target.value }))} /></Field><div className="coa-fields-row"><Field label="ماهیت"><Select value={draft.nature} onChange={(event) => setDraft((current) => ({ ...current, nature: event.target.value as AccountNature }))}><option value="uncontrolled">کنترل‌نشده</option><option value="debit">بدهکار</option><option value="credit">بستانکار</option><option value="strict_debit">صرفاً بدهکار</option><option value="strict_credit">صرفاً بستانکار</option></Select></Field><Field label="مانده عادی"><Select value={draft.normalBalance} onChange={(event) => setDraft((current) => ({ ...current, normalBalance: event.target.value as NormalBalance }))}><option value="debit">بدهکار</option><option value="credit">بستانکار</option></Select></Field></div><Field label="صورت مالی"><Select value={draft.statementType} onChange={(event) => setDraft((current) => ({ ...current, statementType: event.target.value as AccountStatementType }))}><option value="balance_sheet">ترازنامه</option><option value="income_statement">سود و زیان</option><option value="memorandum">انتظامی</option></Select></Field>{draft.level === "subsidiary" ? <label className="coa-check"><input type="checkbox" checked={draft.postingAllowed} onChange={(event) => setDraft((current) => ({ ...current, postingAllowed: event.target.checked }))} /> ثبت سند روی این حساب مجاز باشد</label> : null}<Button variant="primary" type="submit" disabled={busy || (editing === null ? !can(chartOfAccountsPermissions.create) : !can(chartOfAccountsPermissions.update))}>{busy ? "در حال انجام…" : editing === null ? "ایجاد حساب" : "ذخیره تغییرات"}</Button></form></Panel>
          {settings ? <Panel className="coa-card"><form className="coa-form" onSubmit={(event) => void saveSettings(event)}><div className="coa-card__title"><div><h2>تنظیمات کدینگ</h2><p>طول کدها و قواعد سلسله‌مراتبی شرکت</p></div><Badge>نسخه {settings.version.toLocaleString("fa-IR")}</Badge></div><div className="coa-settings-grid">{([["groupCodeLength", "طول کد گروه"], ["generalCodeLength", "طول کد کل"], ["subsidiaryCodeLength", "طول کد معین"]] as const).map(([field, label]) => <Field key={field} label={label}><Input type="number" min={1} max={20} value={settings[field]} onChange={(event) => setSettings({ ...settings, [field]: Number(event.target.value) })} /></Field>)}</div><label className="coa-check"><input type="checkbox" checked={settings.enforceHierarchicalCodes} onChange={(event) => setSettings({ ...settings, enforceHierarchicalCodes: event.target.checked })} /> الزام پیشوند سلسله‌مراتبی</label><label className="coa-check"><input type="checkbox" checked={settings.allowCodeChangeAfterUse} onChange={(event) => setSettings({ ...settings, allowCodeChangeAfterUse: event.target.checked })} /> اجازه تغییر کد پس از استفاده</label><Button type="submit" disabled={busy || !can(chartOfAccountsPermissions.manageSettings)}>ذخیره تنظیمات</Button></form></Panel> : null}
        </aside>
      </div>
    </Page>
  );
}
