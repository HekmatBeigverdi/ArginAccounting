import type {
  AccountLevel,
  AccountNature,
  AccountStatementType,
  NormalBalance,
} from "./account.ts";
import type {
  BalanceSheetSection,
  CashFlowCategory,
  IncomeStatementSection,
} from "./account-report-classification.ts";
import type { AccountDimensionRequirement } from "./account-dimension-policy.ts";

export interface CodingTemplateAccountItem {
  readonly logicalKey: string;
  readonly parentLogicalKey: string | null;
  readonly level: AccountLevel;
  readonly code: string;
  readonly persianName: string;
  readonly englishName: string | null;
  readonly nature: AccountNature;
  readonly normalBalance: NormalBalance;
  readonly statementType: AccountStatementType;
  readonly reportClassification: Readonly<CodingTemplateAccountReportClassification>;
  readonly postingAllowed: boolean;
  readonly currencyEnabled: boolean;
  readonly revaluationEnabled: boolean;
  readonly trackingEnabled: boolean;
  readonly dueDateEnabled: boolean;
  readonly activeByDefault: boolean;
  readonly displayOrder: number;
}

export interface CodingTemplateAccountReportClassification {
  readonly balanceSheetSection: BalanceSheetSection | null;
  readonly incomeStatementSection: IncomeStatementSection | null;
  readonly cashFlowCategory: CashFlowCategory | null;
  readonly cashEquivalent: boolean;
  readonly receivable: boolean;
  readonly payable: boolean;
  readonly managementTags: readonly string[];
}

export interface CodingTemplateDimensionTypeItem {
  readonly logicalKey: string;
  readonly code: string;
  readonly persianName: string;
  readonly englishName: string | null;
  readonly hierarchical: boolean;
  readonly allowMultipleMembers: boolean;
  readonly activeByDefault: boolean;
  readonly displayOrder: number;
}

export interface CodingTemplateDimensionMemberItem {
  readonly logicalKey: string;
  readonly dimensionTypeLogicalKey: string;
  readonly parentLogicalKey: string | null;
  readonly code: string;
  readonly persianName: string;
  readonly englishName: string | null;
  readonly activeByDefault: boolean;
  readonly displayOrder: number;
}

export interface CodingTemplateAccountDimensionPolicyItem {
  readonly accountLogicalKey: string;
  readonly dimensionTypeLogicalKey: string;
  readonly requirement: AccountDimensionRequirement;
}

export interface CodingTemplateVersionContent {
  readonly accounts: readonly Readonly<CodingTemplateAccountItem>[];
  readonly dimensionTypes: readonly Readonly<CodingTemplateDimensionTypeItem>[];
  readonly dimensionMembers: readonly Readonly<CodingTemplateDimensionMemberItem>[];
  readonly accountDimensionPolicies:
    readonly Readonly<CodingTemplateAccountDimensionPolicyItem>[];
}
