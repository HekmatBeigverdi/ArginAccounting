import type {
  AccountCode,
} from "./account-code.ts";
import type {
  AccountName,
} from "./account-name.ts";
import type {
  AccountReportClassification,
  CreateAccountReportClassificationInput,
} from "./account-report-classification.ts";

export type AccountLevel =
  | "group"
  | "general"
  | "subsidiary";

export type AccountNature =
  | "uncontrolled"
  | "debit"
  | "credit"
  | "strict_debit"
  | "strict_credit";

export type NormalBalance =
  | "debit"
  | "credit";

export type AccountStatementType =
  | "balance_sheet"
  | "income_statement"
  | "memorandum";

export type AccountStatus =
  | "active"
  | "inactive";

export type AccountSourceType =
  | "manual"
  | "coding_template"
  | "excel_import";

export interface Account {
  readonly id: string;
  readonly companyId: string;
  readonly parentId: string | null;

  readonly level: AccountLevel;
  readonly code: AccountCode;
  readonly name: AccountName;
  readonly englishName: string | null;

  readonly nature: AccountNature;
  readonly normalBalance: NormalBalance;
  readonly statementType: AccountStatementType;
  readonly reportClassification:
    AccountReportClassification;

  readonly postingAllowed: boolean;
  readonly currencyEnabled: boolean;
  readonly revaluationEnabled: boolean;
  readonly trackingEnabled: boolean;
  readonly dueDateEnabled: boolean;

  readonly status: AccountStatus;
  readonly displayOrder: number;

  readonly sourceType: AccountSourceType;
  readonly sourceReferenceId: string | null;

  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface CreateAccountInput {
  readonly id: string;
  readonly companyId: string;
  readonly parentId?: string | null;

  readonly level: AccountLevel;
  readonly code: string;
  readonly name: string;
  readonly englishName?: string | null;

  readonly nature: AccountNature;
  readonly normalBalance: NormalBalance;
  readonly statementType: AccountStatementType;
  readonly reportClassification?:
    CreateAccountReportClassificationInput;

  readonly postingAllowed?: boolean;
  readonly currencyEnabled?: boolean;
  readonly revaluationEnabled?: boolean;
  readonly trackingEnabled?: boolean;
  readonly dueDateEnabled?: boolean;

  readonly status?: AccountStatus;
  readonly displayOrder?: number;

  readonly sourceType?: AccountSourceType;
  readonly sourceReferenceId?: string | null;

  readonly createdAt: string;
}
