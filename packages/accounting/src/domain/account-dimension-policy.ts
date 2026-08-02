export type AccountDimensionRequirement =
  | "required"
  | "optional"
  | "forbidden";

export interface AccountDimensionPolicy {
  readonly id: string;
  readonly companyId: string;
  readonly accountId: string;
  readonly dimensionTypeId: string;

  readonly requirement: AccountDimensionRequirement;

  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface CreateAccountDimensionPolicyInput {
  readonly id: string;
  readonly companyId: string;
  readonly accountId: string;
  readonly dimensionTypeId: string;

  readonly requirement: AccountDimensionRequirement;

  readonly createdAt: string;
}
