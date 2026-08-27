import type { Branch } from "@argin/company";

export interface AccountingReportFilterAccountOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface AccountingReportFilterDimensionTypeOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface AccountingReportFilterDimensionMemberOption {
  readonly id: string;
  readonly dimensionTypeId: string;
  readonly code: string;
  readonly name: string;
}

export interface AccountingReportFilterState {
  readonly fromDate: string;
  readonly toDate: string;
  readonly branchMode: "all" | "branch";
  readonly branchId: string;
  readonly accountId: string;
  readonly includeDescendants: boolean;
  readonly dimensionTypeId: string;
  readonly dimensionMemberId: string;
  readonly includeZeroBalances: boolean;
}

export function AccountingReportFilters({
  value,
  branches,
  canSelectAllBranches,
  accounts,
  dimensionTypes,
  dimensionMembers,
  busy,
  disabled,
  onChange,
  onRun,
  onReset,
}: {
  value: AccountingReportFilterState;
  branches: readonly Branch[];
  canSelectAllBranches: boolean;
  accounts: readonly AccountingReportFilterAccountOption[];
  dimensionTypes: readonly AccountingReportFilterDimensionTypeOption[];
  dimensionMembers: readonly AccountingReportFilterDimensionMemberOption[];
  busy: boolean;
  disabled: boolean;
  onChange(value: AccountingReportFilterState): void;
  onRun(): void;
  onReset(): void;
}) {
  const selectedDimensionMembers = dimensionMembers.filter(
    (member) => member.dimensionTypeId === value.dimensionTypeId,
  );

  function patch(changes: Partial<AccountingReportFilterState>): void {
    onChange(Object.freeze({ ...value, ...changes }));
  }

  return (
    <section className="reports-filterbar" aria-label="فیلترهای گزارش حسابداری">
      <label>
        از تاریخ
        <input
          type="date"
          value={value.fromDate}
          onChange={(event) => patch({ fromDate: event.target.value })}
        />
      </label>
      <label>
        تا تاریخ
        <input
          type="date"
          value={value.toDate}
          onChange={(event) => patch({ toDate: event.target.value })}
        />
      </label>
      <label>
        دامنه شعب
        <select
          value={value.branchMode}
          onChange={(event) =>
            patch({ branchMode: event.target.value as "all" | "branch" })
          }
        >
          <option value="branch">یک شعبه</option>
          {canSelectAllBranches && <option value="all">همه شعب مجاز</option>}
        </select>
      </label>
      {value.branchMode === "branch" && (
        <label>
          شعبه
          <select
            value={value.branchId}
            onChange={(event) => patch({ branchId: event.target.value })}
          >
            <option value="">انتخاب شعبه</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} — {branch.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        حساب
        <select
          value={value.accountId}
          onChange={(event) => patch({ accountId: event.target.value })}
        >
          <option value="">همه حساب‌ها</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.code} — {account.name}
            </option>
          ))}
        </select>
      </label>
      <label className="reports-filterbar__check">
        <input
          type="checkbox"
          checked={value.includeDescendants}
          disabled={!value.accountId}
          onChange={(event) => patch({ includeDescendants: event.target.checked })}
        />
        زیرحساب‌ها نیز لحاظ شوند
      </label>
      <label>
        نوع بُعد
        <select
          value={value.dimensionTypeId}
          onChange={(event) =>
            patch({
              dimensionTypeId: event.target.value,
              dimensionMemberId: "",
            })
          }
        >
          <option value="">بدون فیلتر بُعد</option>
          {dimensionTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.code} — {type.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        عضو بُعد
        <select
          value={value.dimensionMemberId}
          disabled={!value.dimensionTypeId}
          onChange={(event) => patch({ dimensionMemberId: event.target.value })}
        >
          <option value="">همه اعضا</option>
          {selectedDimensionMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.code} — {member.name}
            </option>
          ))}
        </select>
      </label>
      <label className="reports-filterbar__check">
        <input
          type="checkbox"
          checked={value.includeZeroBalances}
          onChange={(event) => patch({ includeZeroBalances: event.target.checked })}
        />
        نمایش مانده‌های صفر
      </label>
      <div className="reports-filterbar__actions">
        <button type="button" disabled={busy} onClick={onReset}>
          بازنشانی
        </button>
        <button
          className="ui-button"
          type="button"
          disabled={disabled || busy}
          onClick={onRun}
        >
          {busy ? "در حال تهیه…" : "نمایش گزارش"}
        </button>
      </div>
    </section>
  );
}
