import type {
  AccountStatementType,
} from "./account.ts";

export type BalanceSheetSection =
  | "assets"
  | "liabilities"
  | "equity";

export type IncomeStatementSection =
  | "revenue"
  | "cost_of_sales"
  | "operating_expenses"
  | "non_operating"
  | "finance_costs"
  | "income_tax";

export type CashFlowCategory =
  | "operating"
  | "investing"
  | "financing"
  | "cash_and_cash_equivalents"
  | "non_cash";

export interface AccountReportClassification {
  readonly balanceSheetSection: BalanceSheetSection | null;
  readonly incomeStatementSection: IncomeStatementSection | null;
  readonly cashFlowCategory: CashFlowCategory | null;
  readonly cashEquivalent: boolean;
  readonly receivable: boolean;
  readonly payable: boolean;
  readonly managementTags: readonly string[];
}

export interface CreateAccountReportClassificationInput {
  readonly balanceSheetSection?: BalanceSheetSection | null;
  readonly incomeStatementSection?: IncomeStatementSection | null;
  readonly cashFlowCategory?: CashFlowCategory | null;
  readonly cashEquivalent?: boolean;
  readonly receivable?: boolean;
  readonly payable?: boolean;
  readonly managementTags?: readonly string[];
}

export interface CreateAccountReportClassificationContext {
  readonly statementType: AccountStatementType;
}
