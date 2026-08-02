export type AccountingDimensionTypeStatus =
  | "active"
  | "inactive";

export type AccountingDimensionTypeSource =
  | "manual"
  | "system"
  | "module";

export interface AccountingDimensionType {
  readonly id: string;
  readonly companyId: string;

  readonly code: string;
  readonly name: string;
  readonly englishName: string | null;

  readonly hierarchical: boolean;
  readonly allowMultipleMembers: boolean;
  readonly status: AccountingDimensionTypeStatus;
  readonly displayOrder: number;

  readonly source: AccountingDimensionTypeSource;
  readonly sourceReferenceId: string | null;

  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface CreateAccountingDimensionTypeInput {
  readonly id: string;
  readonly companyId: string;

  readonly code: string;
  readonly name: string;
  readonly englishName?: string | null;

  readonly hierarchical?: boolean;
  readonly allowMultipleMembers?: boolean;
  readonly status?: AccountingDimensionTypeStatus;
  readonly displayOrder?: number;

  readonly source?: AccountingDimensionTypeSource;
  readonly sourceReferenceId?: string | null;

  readonly createdAt: string;
}
