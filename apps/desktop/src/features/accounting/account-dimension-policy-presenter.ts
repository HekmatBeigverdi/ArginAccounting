import type {
  Account,
  AccountDimensionPolicy,
  AccountDimensionRequirement,
  AccountingDimensionType,
} from "@argin/accounting";

export interface PolicyFilters {
  readonly text: string;
  readonly accountId: string;
  readonly dimensionTypeId: string;
  readonly requirement: AccountDimensionRequirement | "all";
}

export interface PolicySummary {
  readonly total: number;
  readonly required: number;
  readonly optional: number;
  readonly forbidden: number;
}

export function filterAccountDimensionPolicies(
  policies: readonly AccountDimensionPolicy[],
  accounts: ReadonlyMap<string, Account>,
  types: ReadonlyMap<string, AccountingDimensionType>,
  filters: PolicyFilters,
): readonly AccountDimensionPolicy[] {
  const text = filters.text.trim().toLocaleLowerCase("fa");

  return policies.filter((policy) => {
    if (filters.accountId !== "" && policy.accountId !== filters.accountId) {
      return false;
    }
    if (
      filters.dimensionTypeId !== "" &&
      policy.dimensionTypeId !== filters.dimensionTypeId
    ) {
      return false;
    }
    if (
      filters.requirement !== "all" &&
      policy.requirement !== filters.requirement
    ) {
      return false;
    }
    if (text === "") return true;

    const account = accounts.get(policy.accountId);
    const type = types.get(policy.dimensionTypeId);
    return [account?.code, account?.name, type?.code, type?.name].some((value) =>
      value?.toLocaleLowerCase("fa").includes(text),
    );
  });
}

export function summarizeAccountDimensionPolicies(
  policies: readonly AccountDimensionPolicy[],
): PolicySummary {
  return policies.reduce<PolicySummary>(
    (summary, policy) => ({
      total: summary.total + 1,
      required: summary.required + Number(policy.requirement === "required"),
      optional: summary.optional + Number(policy.requirement === "optional"),
      forbidden:
        summary.forbidden + Number(policy.requirement === "forbidden"),
    }),
    { total: 0, required: 0, optional: 0, forbidden: 0 },
  );
}

export function findAccountDimensionPolicy(
  policies: readonly AccountDimensionPolicy[],
  accountId: string,
  dimensionTypeId: string,
): AccountDimensionPolicy | undefined {
  return policies.find(
    (policy) =>
      policy.accountId === accountId &&
      policy.dimensionTypeId === dimensionTypeId,
  );
}
