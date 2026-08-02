import type { AccountDimensionRequirement } from "../domain/account-dimension-policy.ts";
import type { AccountingDimensionAssignment } from "../domain/accounting-dimension-assignment.ts";

export interface LoadAccountingDimensionSelectorRequest {
  readonly companyId: string;
  readonly accountId: string;
  readonly documentDate: string;
  readonly assignments?: readonly AccountingDimensionAssignment[];
}

export interface AccountingDimensionSelectorOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly displayOrder: number;
}

export interface AccountingDimensionSelectorField {
  readonly dimensionTypeId: string;
  readonly code: string;
  readonly label: string;
  readonly requirement: AccountDimensionRequirement;
  readonly required: boolean;
  readonly disabled: boolean;
  readonly multiple: boolean;
  readonly hierarchical: boolean;
  readonly selectedMemberIds: readonly string[];
  readonly options: readonly AccountingDimensionSelectorOption[];
}

export interface AccountingDimensionSelectorModel {
  readonly companyId: string;
  readonly accountId: string;
  readonly documentDate: string;
  readonly fields: readonly AccountingDimensionSelectorField[];
}

export interface AccountingDimensionSelectorService {
  load(
    request: LoadAccountingDimensionSelectorRequest,
  ): Promise<AccountingDimensionSelectorModel>;
}
