export type AccountingDimensionMemberStatus =
  | "active"
  | "inactive";

export type AccountingDimensionMemberSource =
  | "manual"
  | "system"
  | "module";

export interface AccountingDimensionMember {
  readonly id: string;
  readonly companyId: string;
  readonly dimensionTypeId: string;

  readonly code: string;
  readonly name: string;
  readonly englishName: string | null;
  readonly parentId: string | null;

  readonly status: AccountingDimensionMemberStatus;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly displayOrder: number;

  readonly source: AccountingDimensionMemberSource;
  readonly sourceReferenceId: string | null;

  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface CreateAccountingDimensionMemberInput {
  readonly id: string;
  readonly companyId: string;
  readonly dimensionTypeId: string;

  readonly code: string;
  readonly name: string;
  readonly englishName?: string | null;
  readonly parentId?: string | null;

  readonly status?: AccountingDimensionMemberStatus;
  readonly validFrom?: string | null;
  readonly validTo?: string | null;
  readonly displayOrder?: number;

  readonly source?: AccountingDimensionMemberSource;
  readonly sourceReferenceId?: string | null;

  readonly createdAt: string;
}
