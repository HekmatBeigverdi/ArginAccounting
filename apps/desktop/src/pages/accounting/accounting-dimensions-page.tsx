import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  accountingDimensionsPermissions,
  chartOfAccountsPermissions,
  type Account,
  type AccountDimensionPolicy,
  type AccountDimensionRequirement,
  type AccountingDimensionMember,
  type AccountingDimensionType,
} from "@argin/accounting";
import type { Company } from "@argin/company";
import { SqliteCompanyRepository } from "@argin/company-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Feedback } from "../../components/feedback";
import { Field, Select } from "../../components/forms";
import { Page } from "../../components/layout";
import { useAccountingServices } from "../../composition/accounting/accounting-provider";
import { AccountDimensionPolicyWorkspace } from "../../features/accounting/account-dimension-policy-workspace";
import { getAccountingDimensionsErrorMessage } from "../../features/accounting/accounting-dimensions-presenter";
import { flattenAccountTree } from "../../features/accounting/chart-of-accounts-presenter";

import "./accounting-workspace.css";
import "./accounting-dimensions-page.css";

type View = "types" | "members" | "policies";

const views: readonly [View, string][] = [
  ["types", "انواع بُعد"],
  ["members", "اعضای بُعد"],
  ["policies", "سیاست حساب–بُعد"],
];

interface TypeDraft {
  code: string;
  name: string;
  englishName: string;
  hierarchical: boolean;
  allowMultipleMembers: boolean;
  displayOrder: string;
}

interface MemberDraft {
  code: string;
  name: string;
  englishName: string;
  parentId: string;
  displayOrder: string;
}

const emptyTypeDraft: TypeDraft = {
  code: "",
  name: "",
  englishName: "",
  hierarchical: false,
  allowMultipleMembers: false,
  displayOrder: "0",
};
const emptyMemberDraft: MemberDraft = {
  code: "",
  name: "",
  englishName: "",
  parentId: "",
  displayOrder: "0",
};

function nextStatus(status: "active" | "inactive"): "active" | "inactive" {
  return status === "active" ? "inactive" : "active";
}

export function AccountingDimensionsPage() {
  const { chartOfAccounts, dimensions } = useAccountingServices();
  const { session } = useAuthSession();
  const [companies, setCompanies] = useState<readonly Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [types, setTypes] = useState<readonly AccountingDimensionType[]>([]);
  const [members, setMembers] = useState<readonly AccountingDimensionMember[]>(
    [],
  );
  const [policies, setPolicies] = useState<readonly AccountDimensionPolicy[]>(
    [],
  );
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [view, setView] = useState<View>("types");
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [typeDraft, setTypeDraft] = useState<TypeDraft>(emptyTypeDraft);
  const [memberDraft, setMemberDraft] = useState<MemberDraft>(emptyMemberDraft);
  const [editingType, setEditingType] =
    useState<AccountingDimensionType | null>(null);
  const [editingMember, setEditingMember] =
    useState<AccountingDimensionMember | null>(null);
  const [policyAccountId, setPolicyAccountId] = useState("");
  const [policyTypeId, setPolicyTypeId] = useState("");
  const [requirement, setRequirement] =
    useState<AccountDimensionRequirement>("optional");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const permissions = useMemo(
    () => new Set(session?.user.permissions ?? []),
    [session],
  );
  const can = useCallback(
    (permission: string) =>
      permissions.has("system.full-access") || permissions.has(permission),
    [permissions],
  );

  useEffect(() => {
    void getDesktopDatabase()
      .then((database) => new SqliteCompanyRepository(database).findAll())
      .then((values) => {
        setCompanies(values);
        setCompanyId((current) => current || values[0]?.id || "");
      })
      .catch((reason: unknown) =>
        setError(getAccountingDimensionsErrorMessage(reason)),
      );
  }, []);

  const reload = useCallback(async () => {
    if (companyId === "" || !can(accountingDimensionsPermissions.view)) {
      setTypes([]);
      setMembers([]);
      setPolicies([]);
      setAccounts([]);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const [typeResult, memberResult, policyResult] = await Promise.all([
        dimensions.searchDimensionTypes({
          companyId,
          pagination: { page: 1, pageSize: 200 },
        }),
        dimensions.searchMembers({
          companyId,
          pagination: { page: 1, pageSize: 500 },
        }),
        dimensions.searchPolicies({
          companyId,
          pagination: { page: 1, pageSize: 500 },
        }),
      ]);
      const accountTree = can(chartOfAccountsPermissions.view)
        ? await chartOfAccounts.getAccountTree(companyId)
        : [];
      setTypes(typeResult.items);
      setMembers(memberResult.items);
      setPolicies(policyResult.items);
      const flattenedAccounts = flattenAccountTree(accountTree).map(
        ({ account }) => account,
      );
      setAccounts(flattenedAccounts);
      setSelectedTypeId((current) =>
        typeResult.items.some((item) => item.id === current)
          ? current
          : (typeResult.items[0]?.id ?? ""),
      );
      setPolicyTypeId((current) => current || typeResult.items[0]?.id || "");
      setPolicyAccountId(
        (current) =>
          current ||
          flattenedAccounts.find(
            (account) => account.status === "active" && account.postingAllowed,
          )?.id ||
          "",
      );
    } catch (reason) {
      setError(getAccountingDimensionsErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }, [can, chartOfAccounts, companyId, dimensions]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectedType = types.find((item) => item.id === selectedTypeId) ?? null;
  const visibleMembers = members.filter(
    (member) =>
      member.dimensionTypeId === selectedTypeId &&
      matches(member.code, member.name, search),
  );
  const visibleTypes = types.filter((type) =>
    matches(type.code, type.name, search),
  );
  function clearFeedback(): void {
    setMessage("");
    setError("");
  }

  function changeView(nextView: View): void {
    setView(nextView);
    setSearch("");
    clearFeedback();
  }

  function editType(type: AccountingDimensionType): void {
    clearFeedback();
    setEditingType(type);
    setTypeDraft({
      code: type.code,
      name: type.name,
      englishName: type.englishName ?? "",
      hierarchical: type.hierarchical,
      allowMultipleMembers: type.allowMultipleMembers,
      displayOrder: String(type.displayOrder),
    });
  }

  async function submitType(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    clearFeedback();
    try {
      const values = {
        code: typeDraft.code,
        name: typeDraft.name,
        englishName: typeDraft.englishName || null,
        hierarchical: typeDraft.hierarchical,
        allowMultipleMembers: typeDraft.allowMultipleMembers,
        displayOrder: Number(typeDraft.displayOrder),
        source: "manual" as const,
        sourceReferenceId: null,
      };
      if (editingType === null) {
        await dimensions.createDimensionType({ companyId, ...values });
        setMessage("نوع بُعد حسابداری ایجاد شد.");
      } else {
        await dimensions.updateDimensionType({
          companyId,
          dimensionTypeId: editingType.id,
          expectedVersion: editingType.version,
          changes: values,
        });
        setMessage("تغییرات نوع بُعد ذخیره شد.");
      }
      setEditingType(null);
      setTypeDraft(emptyTypeDraft);
      await reload();
    } catch (reason) {
      setError(getAccountingDimensionsErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function editMember(member: AccountingDimensionMember): void {
    clearFeedback();
    setEditingMember(member);
    setMemberDraft({
      code: member.code,
      name: member.name,
      englishName: member.englishName ?? "",
      parentId: member.parentId ?? "",
      displayOrder: String(member.displayOrder),
    });
  }

  async function submitMember(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (selectedType === null) return;
    setBusy(true);
    clearFeedback();
    try {
      const values = {
        code: memberDraft.code,
        name: memberDraft.name,
        englishName: memberDraft.englishName || null,
        parentId: memberDraft.parentId || null,
        displayOrder: Number(memberDraft.displayOrder),
        validFrom: null,
        validTo: null,
        source: "manual" as const,
        sourceReferenceId: null,
      };
      if (editingMember === null) {
        await dimensions.createMember({
          companyId,
          dimensionTypeId: selectedType.id,
          ...values,
        });
        setMessage("عضو بُعد حسابداری ایجاد شد.");
      } else {
        await dimensions.updateMember({
          companyId,
          memberId: editingMember.id,
          expectedVersion: editingMember.version,
          changes: values,
        });
        setMessage("تغییرات عضو بُعد ذخیره شد.");
      }
      setEditingMember(null);
      setMemberDraft(emptyMemberDraft);
      await reload();
    } catch (reason) {
      setError(getAccountingDimensionsErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function toggleType(type: AccountingDimensionType): Promise<void> {
    const status = nextStatus(type.status);
    await runAction(
      () =>
        dimensions.setDimensionTypeStatus(
          companyId,
          type.id,
          status,
          type.version,
        ),
      status === "active" ? "نوع بُعد فعال شد." : "نوع بُعد غیرفعال شد.",
    );
  }
  async function toggleMember(
    member: AccountingDimensionMember,
  ): Promise<void> {
    const status = nextStatus(member.status);
    await runAction(
      () =>
        dimensions.setMemberStatus(
          companyId,
          member.id,
          status,
          member.version,
        ),
      status === "active" ? "عضو بُعد فعال شد." : "عضو بُعد غیرفعال شد.",
    );
  }
  async function removeType(type: AccountingDimensionType): Promise<void> {
    if (!window.confirm(`نوع بُعد «${type.name}» حذف شود؟`)) return;
    await runAction(
      () => dimensions.deleteDimensionType(companyId, type.id, type.version),
      "نوع بُعد حذف شد.",
    );
  }
  async function removeMember(
    member: AccountingDimensionMember,
  ): Promise<void> {
    if (!window.confirm(`عضو «${member.name}» حذف شود؟`)) return;
    await runAction(
      () => dimensions.deleteMember(companyId, member.id, member.version),
      "عضو بُعد حذف شد.",
    );
  }
  async function submitPolicy(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    await runAction(
      () =>
        dimensions.createPolicy({
          companyId,
          accountId: policyAccountId,
          dimensionTypeId: policyTypeId,
          requirement,
        }),
      "سیاست حساب و بُعد ایجاد شد.",
    );
  }
  async function updatePolicy(
    policy: AccountDimensionPolicy,
    next: AccountDimensionRequirement,
  ): Promise<void> {
    await runAction(
      () =>
        dimensions.updatePolicy({
          companyId,
          policyId: policy.id,
          expectedVersion: policy.version,
          requirement: next,
        }),
      "سیاست حساب و بُعد به‌روزرسانی شد.",
    );
  }
  async function removePolicy(policy: AccountDimensionPolicy): Promise<void> {
    if (!window.confirm("این سیاست حساب و بُعد حذف شود؟")) return;
    await runAction(
      () => dimensions.deletePolicy(companyId, policy.id, policy.version),
      "سیاست حساب و بُعد حذف شد.",
    );
  }
  async function runAction(
    action: () => Promise<unknown>,
    success: string,
  ): Promise<void> {
    setBusy(true);
    clearFeedback();
    try {
      await action();
      setMessage(success);
      await reload();
    } catch (reason) {
      setError(getAccountingDimensionsErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  if (!can(accountingDimensionsPermissions.view))
    return (
      <Page
        className="accounting-workspace dimensions-page"
        lang="fa"
        dir="rtl"
      >
        <Feedback tone="error">
          شما مجوز مشاهده ابعاد حسابداری را ندارید.
        </Feedback>
      </Page>
    );

  return (
    <Page className="accounting-workspace dimensions-page" lang="fa" dir="rtl">
      <header className="accounting-workspace__header dimensions-header">
        <div>
          <p className="accounting-workspace__eyebrow">
            حسابداری / اطلاعات پایه
          </p>
          <h1>ابعاد حسابداری</h1>
          <p>تعریف انواع بُعد، اعضای سلسله‌مراتبی و سیاست‌های تخصیص به حساب</p>
        </div>
        <Field label="شرکت" className="dimensions-company">
          <Select
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.legalName}
              </option>
            ))}
          </Select>
        </Field>
      </header>

      <nav
        className="accounting-workspace__tabs dimensions-tabs"
        aria-label="بخش‌های ابعاد حسابداری"
      >
        {views.map(([item, label]) => (
          <button
            key={item}
            type="button"
            aria-current={view === item ? "page" : undefined}
            onClick={() => changeView(item)}
          >
            {label}
          </button>
        ))}
      </nav>

      {companies.length === 0 && !busy ? (
        <Feedback tone="warning">
          ابتدا از بخش «شرکت‌ها و شعب» یک شرکت ایجاد کنید.
        </Feedback>
      ) : null}
      {error ? <Feedback tone="error">{error}</Feedback> : null}
      {message ? <Feedback tone="success">{message}</Feedback> : null}

      {view !== "policies" ? (
        <div className="dimensions-toolbar">
          {view === "members" ? (
            <label>
              نوع بُعد
              <select
                value={selectedTypeId}
                onChange={(event) => setSelectedTypeId(event.target.value)}
              >
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="dimensions-toolbar__search">
            جست‌وجو
            <input
              value={search}
              placeholder="کد یا عنوان"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="button" disabled={busy} onClick={() => void reload()}>
            تازه‌سازی
          </button>
        </div>
      ) : null}

      {view === "types" ? (
        <div className="dimensions-layout">
          <DimensionTable
            rows={visibleTypes}
            busy={busy}
            canUpdate={can(accountingDimensionsPermissions.update)}
            canChangeStatus={can(accountingDimensionsPermissions.changeStatus)}
            canDelete={can(accountingDimensionsPermissions.delete)}
            onEdit={editType}
            onToggle={(item) => void toggleType(item)}
            onDelete={(item) => void removeType(item)}
          />
          {can(accountingDimensionsPermissions.create) ||
          can(accountingDimensionsPermissions.update) ? (
            <TypeForm
              draft={typeDraft}
              editing={editingType !== null}
              busy={busy}
              onChange={setTypeDraft}
              onCancel={() => {
                setEditingType(null);
                setTypeDraft(emptyTypeDraft);
              }}
              onSubmit={(event) => void submitType(event)}
            />
          ) : null}
        </div>
      ) : null}
      {view === "members" ? (
        <div className="dimensions-layout">
          <MemberTable
            rows={visibleMembers}
            busy={busy}
            canUpdate={can(accountingDimensionsPermissions.update)}
            canChangeStatus={can(accountingDimensionsPermissions.changeStatus)}
            canDelete={can(accountingDimensionsPermissions.delete)}
            onEdit={editMember}
            onToggle={(item) => void toggleMember(item)}
            onDelete={(item) => void removeMember(item)}
          />
          {selectedType !== null &&
          (can(accountingDimensionsPermissions.create) ||
            can(accountingDimensionsPermissions.update)) ? (
            <MemberForm
              draft={memberDraft}
              editing={editingMember !== null}
              hierarchical={selectedType.hierarchical}
              members={visibleMembers}
              editingId={editingMember?.id ?? null}
              busy={busy}
              onChange={setMemberDraft}
              onCancel={() => {
                setEditingMember(null);
                setMemberDraft(emptyMemberDraft);
              }}
              onSubmit={(event) => void submitMember(event)}
            />
          ) : null}
        </div>
      ) : null}
      {view === "policies" ? (
        <>
          {!can(chartOfAccountsPermissions.view) ? (
            <Feedback tone="warning">
              برای مشاهده نام حساب‌ها و مدیریت سیاست‌ها، مجوز مشاهده کدینگ
              حساب‌ها نیز لازم است.
            </Feedback>
          ) : null}
          <AccountDimensionPolicyWorkspace
            policies={policies}
            accounts={accounts}
            types={types}
            accountId={policyAccountId}
            typeId={policyTypeId}
            requirement={requirement}
            busy={busy}
            canManage={
              can(accountingDimensionsPermissions.managePolicies) &&
              can(chartOfAccountsPermissions.view)
            }
            onAccountChange={setPolicyAccountId}
            onTypeChange={setPolicyTypeId}
            onRequirementChange={setRequirement}
            onSubmit={(event) => void submitPolicy(event)}
            onUpdate={(policy, next) => void updatePolicy(policy, next)}
            onDelete={(policy) => void removePolicy(policy)}
          />
        </>
      ) : null}
    </Page>
  );
}

function matches(code: string, name: string, search: string): boolean {
  const text = search.trim().toLocaleLowerCase("fa");
  return (
    text === "" ||
    code.toLocaleLowerCase().includes(text) ||
    name.toLocaleLowerCase("fa").includes(text)
  );
}

interface TableActions<T> {
  rows: readonly T[];
  busy: boolean;
  canUpdate: boolean;
  canChangeStatus: boolean;
  canDelete: boolean;
  onEdit: (item: T) => void;
  onToggle: (item: T) => void;
  onDelete: (item: T) => void;
}

function DimensionTable({
  rows,
  busy,
  canUpdate,
  canChangeStatus,
  canDelete,
  onEdit,
  onToggle,
  onDelete,
}: TableActions<AccountingDimensionType>) {
  return (
    <div className="dimensions-card dimensions-table-wrap">
      <table className="dimensions-table">
        <thead>
          <tr>
            <th>کد و عنوان</th>
            <th>نوع</th>
            <th>چندمقداری</th>
            <th>وضعیت</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>
                <b dir="ltr">{item.code}</b>
                {item.name}
              </td>
              <td>{item.hierarchical ? "سلسله‌مراتبی" : "تخت"}</td>
              <td>{item.allowMultipleMembers ? "مجاز" : "تک‌مقداری"}</td>
              <td>
                <span
                  className={`dimensions-badge dimensions-badge--${item.status}`}
                >
                  {item.status === "active" ? "فعال" : "غیرفعال"}
                </span>
              </td>
              <td className="dimensions-actions">
                {canUpdate ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onEdit(item)}
                  >
                    ویرایش
                  </button>
                ) : null}
                {canChangeStatus ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggle(item)}
                  >
                    {item.status === "active" ? "غیرفعال‌سازی" : "فعال‌سازی"}
                  </button>
                ) : null}
                {canDelete ? (
                  <button
                    type="button"
                    className="dimensions-danger"
                    disabled={busy}
                    onClick={() => onDelete(item)}
                  >
                    حذف
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="dimensions-empty">
                نوع بُعدی برای نمایش وجود ندارد.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function MemberTable({
  rows,
  busy,
  canUpdate,
  canChangeStatus,
  canDelete,
  onEdit,
  onToggle,
  onDelete,
}: TableActions<AccountingDimensionMember>) {
  const names = new Map(rows.map((item) => [item.id, item.name] as const));
  return (
    <div className="dimensions-card dimensions-table-wrap">
      <table className="dimensions-table">
        <thead>
          <tr>
            <th>کد و عنوان</th>
            <th>والد</th>
            <th>وضعیت</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>
                <b dir="ltr">{item.code}</b>
                {item.name}
              </td>
              <td>
                {item.parentId
                  ? (names.get(item.parentId) ?? "عضو خارج از فیلتر")
                  : "—"}
              </td>
              <td>
                <span
                  className={`dimensions-badge dimensions-badge--${item.status}`}
                >
                  {item.status === "active" ? "فعال" : "غیرفعال"}
                </span>
              </td>
              <td className="dimensions-actions">
                {canUpdate ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onEdit(item)}
                  >
                    ویرایش
                  </button>
                ) : null}
                {canChangeStatus ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggle(item)}
                  >
                    {item.status === "active" ? "غیرفعال‌سازی" : "فعال‌سازی"}
                  </button>
                ) : null}
                {canDelete ? (
                  <button
                    type="button"
                    className="dimensions-danger"
                    disabled={busy}
                    onClick={() => onDelete(item)}
                  >
                    حذف
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="dimensions-empty">
                عضوی برای نمایش وجود ندارد.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

interface TypeFormProps {
  draft: TypeDraft;
  editing: boolean;
  busy: boolean;
  onChange: (value: TypeDraft) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}
function TypeForm({
  draft,
  editing,
  busy,
  onChange,
  onCancel,
  onSubmit,
}: TypeFormProps) {
  return (
    <form className="dimensions-card dimensions-form" onSubmit={onSubmit}>
      <header>
        <h2>{editing ? "ویرایش نوع بُعد" : "نوع بُعد جدید"}</h2>
        {editing ? (
          <button type="button" onClick={onCancel}>
            انصراف
          </button>
        ) : null}
      </header>
      <label>
        کد
        <input
          required
          dir="ltr"
          value={draft.code}
          onChange={(event) => onChange({ ...draft, code: event.target.value })}
        />
      </label>
      <label>
        عنوان فارسی
        <input
          required
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </label>
      <label>
        عنوان انگلیسی
        <input
          dir="ltr"
          value={draft.englishName}
          onChange={(event) =>
            onChange({ ...draft, englishName: event.target.value })
          }
        />
      </label>
      <label>
        ترتیب نمایش
        <input
          type="number"
          value={draft.displayOrder}
          onChange={(event) =>
            onChange({ ...draft, displayOrder: event.target.value })
          }
        />
      </label>
      <label className="dimensions-check">
        <input
          type="checkbox"
          checked={draft.hierarchical}
          onChange={(event) =>
            onChange({ ...draft, hierarchical: event.target.checked })
          }
        />{" "}
        اعضا سلسله‌مراتبی باشند
      </label>
      <label className="dimensions-check">
        <input
          type="checkbox"
          checked={draft.allowMultipleMembers}
          onChange={(event) =>
            onChange({ ...draft, allowMultipleMembers: event.target.checked })
          }
        />{" "}
        انتخاب چند عضو در سند مجاز باشد
      </label>
      <button className="dimensions-primary" type="submit" disabled={busy}>
        {busy ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ایجاد نوع بُعد"}
      </button>
    </form>
  );
}

interface MemberFormProps {
  draft: MemberDraft;
  editing: boolean;
  hierarchical: boolean;
  members: readonly AccountingDimensionMember[];
  editingId: string | null;
  busy: boolean;
  onChange: (value: MemberDraft) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}
function MemberForm({
  draft,
  editing,
  hierarchical,
  members,
  editingId,
  busy,
  onChange,
  onCancel,
  onSubmit,
}: MemberFormProps) {
  return (
    <form className="dimensions-card dimensions-form" onSubmit={onSubmit}>
      <header>
        <h2>{editing ? "ویرایش عضو" : "عضو جدید"}</h2>
        {editing ? (
          <button type="button" onClick={onCancel}>
            انصراف
          </button>
        ) : null}
      </header>
      <label>
        کد
        <input
          required
          dir="ltr"
          value={draft.code}
          onChange={(event) => onChange({ ...draft, code: event.target.value })}
        />
      </label>
      <label>
        عنوان فارسی
        <input
          required
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </label>
      <label>
        عنوان انگلیسی
        <input
          dir="ltr"
          value={draft.englishName}
          onChange={(event) =>
            onChange({ ...draft, englishName: event.target.value })
          }
        />
      </label>
      {hierarchical ? (
        <label>
          والد
          <select
            value={draft.parentId}
            onChange={(event) =>
              onChange({ ...draft, parentId: event.target.value })
            }
          >
            <option value="">بدون والد</option>
            {members
              .filter((item) => item.id !== editingId)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {item.name}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      <label>
        ترتیب نمایش
        <input
          type="number"
          value={draft.displayOrder}
          onChange={(event) =>
            onChange({ ...draft, displayOrder: event.target.value })
          }
        />
      </label>
      <button className="dimensions-primary" type="submit" disabled={busy}>
        {busy ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ایجاد عضو"}
      </button>
    </form>
  );
}
