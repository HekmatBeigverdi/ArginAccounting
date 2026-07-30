export interface AccountUsageReader {
  hasFinancialActivity(companyId: string, accountId: string): Promise<boolean>;
}
