import { type FormEvent, useMemo, useState } from "react";

import type {
  Account,
  AccountDimensionPolicy,
  AccountDimensionRequirement,
  AccountingDimensionType,
} from "@argin/accounting";

import {
  dimensionRequirementLabels,
} from "./accounting-dimensions-presenter";
import {
  filterAccountDimensionPolicies,
  findAccountDimensionPolicy,
  summarizeAccountDimensionPolicies,
} from "./account-dimension-policy-presenter";

export interface AccountDimensionPolicyWorkspaceProps {
  readonly policies: readonly AccountDimensionPolicy[];
  readonly accounts: readonly Account[];
  readonly types: readonly AccountingDimensionType[];
  readonly accountId: string;
  readonly typeId: string;
  readonly requirement: AccountDimensionRequirement;
  readonly busy: boolean;
  readonly canManage: boolean;
  readonly onAccountChange: (value: string) => void;
  readonly onTypeChange: (value: string) => void;
  readonly onRequirementChange: (value: AccountDimensionRequirement) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onUpdate: (
    policy: AccountDimensionPolicy,
    value: AccountDimensionRequirement,
  ) => void;
  readonly onDelete: (policy: AccountDimensionPolicy) => void;
}

export function AccountDimensionPolicyWorkspace(
  props: AccountDimensionPolicyWorkspaceProps,
) {
  const [text, setText] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [requirementFilter, setRequirementFilter] = useState<
    AccountDimensionRequirement | "all"
  >("all");
  const accountById = useMemo(
    () => new Map(props.accounts.map((item) => [item.id, item])),
    [props.accounts],
  );
  const typeById = useMemo(
    () => new Map(props.types.map((item) => [item.id, item])),
    [props.types],
  );
  const visiblePolicies = useMemo(
    () =>
      filterAccountDimensionPolicies(props.policies, accountById, typeById, {
        text,
        accountId: accountFilter,
        dimensionTypeId: typeFilter,
        requirement: requirementFilter,
      }),
    [
      accountById,
      accountFilter,
      props.policies,
      requirementFilter,
      text,
      typeById,
      typeFilter,
    ],
  );
  const summary = useMemo(
    () => summarizeAccountDimensionPolicies(visiblePolicies),
    [visiblePolicies],
  );
  const existingPolicy = findAccountDimensionPolicy(
    props.policies,
    props.accountId,
    props.typeId,
  );
  const activeAccounts = props.accounts.filter(
    (item) => item.status === "active" && item.postingAllowed,
  );
  const activeTypes = props.types.filter((item) => item.status === "active");

  return (
    <div className="dimensions-policy-workspace">
      <div className="dimensions-policy-summary" aria-label="خلاصه سیاست‌ها">
        <SummaryCard label="کل سیاست‌ها" value={summary.total} />
        <SummaryCard label="اجباری" value={summary.required} tone="required" />
        <SummaryCard label="اختیاری" value={summary.optional} tone="optional" />
        <SummaryCard label="ممنوع" value={summary.forbidden} tone="forbidden" />
      </div>

      <div className="dimensions-card dimensions-policy-filters">
        <label>
          جست‌وجو
          <input
            value={text}
            placeholder="کد یا عنوان حساب و بُعد"
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <label>
          حساب
          <select
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
          >
            <option value="">همه حساب‌ها</option>
            {props.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} — {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          نوع بُعد
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="">همه ابعاد</option>
            {props.types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          الزام
          <select
            value={requirementFilter}
            onChange={(event) =>
              setRequirementFilter(
                event.target.value as AccountDimensionRequirement | "all",
              )
            }
          >
            <option value="all">همه وضعیت‌ها</option>
            {requirementOptions()}
          </select>
        </label>
      </div>

      <div className="dimensions-policy-layout">
        <div className="dimensions-card dimensions-table-wrap">
          <table className="dimensions-table">
            <thead>
              <tr>
                <th>حساب</th>
                <th>نوع بُعد</th>
                <th>الزام</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {visiblePolicies.map((policy) => (
                <tr key={policy.id}>
                  <td>
                    <b>{accountById.get(policy.accountId)?.code ?? "—"}</b>
                    {accountById.get(policy.accountId)?.name ?? "حساب ناموجود"}
                  </td>
                  <td>
                    {typeById.get(policy.dimensionTypeId)?.name ??
                      "نوع بُعد ناموجود"}
                  </td>
                  <td>
                    {props.canManage ? (
                      <select
                        aria-label="نوع الزام"
                        disabled={props.busy}
                        value={policy.requirement}
                        onChange={(event) =>
                          props.onUpdate(
                            policy,
                            event.target.value as AccountDimensionRequirement,
                          )
                        }
                      >
                        {requirementOptions()}
                      </select>
                    ) : (
                      dimensionRequirementLabels[policy.requirement]
                    )}
                  </td>
                  <td>
                    {props.canManage && (
                      <button
                        type="button"
                        className="dimensions-danger"
                        disabled={props.busy}
                        onClick={() => props.onDelete(policy)}
                      >
                        حذف
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {visiblePolicies.length === 0 && (
                <tr>
                  <td colSpan={4} className="dimensions-empty">
                    سیاستی مطابق فیلترها یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {props.canManage && (
          <form
            className="dimensions-card dimensions-form"
            onSubmit={props.onSubmit}
          >
            <header>
              <h2>سیاست جدید</h2>
            </header>
            <p className="dimensions-form__hint">
              سیاست فقط برای حساب‌های عملیاتی فعال تعریف می‌شود.
            </p>
            <label>
              حساب عملیاتی
              <select
                required
                value={props.accountId}
                onChange={(event) => props.onAccountChange(event.target.value)}
              >
                <option value="">انتخاب کنید</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} — {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              نوع بُعد
              <select
                required
                value={props.typeId}
                onChange={(event) => props.onTypeChange(event.target.value)}
              >
                <option value="">انتخاب کنید</option>
                {activeTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.code} — {type.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              نوع الزام
              <select
                value={props.requirement}
                onChange={(event) =>
                  props.onRequirementChange(
                    event.target.value as AccountDimensionRequirement,
                  )
                }
              >
                {requirementOptions()}
              </select>
            </label>
            {existingPolicy && (
              <p className="dimensions-inline-warning" role="alert">
                برای این حساب و نوع بُعد قبلاً سیاست «
                {dimensionRequirementLabels[existingPolicy.requirement]}» تعریف
                شده است. همان ردیف را ویرایش کنید.
              </p>
            )}
            <button
              className="dimensions-primary"
              disabled={
                props.busy ||
                !props.accountId ||
                !props.typeId ||
                existingPolicy !== undefined
              }
              type="submit"
            >
              ایجاد سیاست
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function SummaryCard(props: {
  label: string;
  value: number;
  tone?: AccountDimensionRequirement;
}) {
  return (
    <div className={`dimensions-card dimensions-summary-card ${props.tone ?? ""}`}>
      <span>{props.label}</span>
      <strong>{props.value.toLocaleString("fa-IR")}</strong>
    </div>
  );
}

function requirementOptions() {
  return (
    Object.entries(dimensionRequirementLabels) as [
      AccountDimensionRequirement,
      string,
    ][]
  ).map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));
}
